"""
JSONL event-stream callback for Proxmox Deployer.

Emits one JSON object per line to JSONL_EVENTS_PATH (env var). Each write is
fsynced so a Node tailer sees events as they happen, not only at playbook end.

Set ANSIBLE_STDOUT_CALLBACK=jsonl_events and ANSIBLE_CALLBACK_PLUGINS to the
directory containing this file.
"""

from __future__ import annotations

import json
import os
import re
import time

from ansible.plugins.callback import CallbackBase

DOCUMENTATION = '''
    callback: jsonl_events
    type: stdout
    short_description: One JSON event per line, fsynced per write
    description:
      - Streams structured task events to a file for live tailing.
'''

NEXT_STEPS_RE = re.compile(r"VM (\d+) \(([^)]+)\) provisioned\.[\s\S]*?IP:\s*(\S+)")


def _ts() -> int:
    return int(time.time() * 1000)


def _ssh_config_snippet(name: str, ip: str, user: str | None = None) -> str:
    user = user or os.environ.get("CLOUD_USER", "admin")
    identity_file = os.environ.get("DEFAULT_IDENTITY_FILE", "~/.ssh/id_ed25519")
    bastion = os.environ.get("PVE_BASTION", "")
    lines = [
        f"Host {name}",
        f"    HostName {ip}",
        f"    User {user}",
        f"    IdentityFile {identity_file}",
    ]
    if bastion:
        lines.append(f"    ProxyJump {bastion}")
    lines.append("")
    return "\n".join(lines)


def _ssh_command(ip: str) -> str:
    user = os.environ.get("CLOUD_USER", "admin")
    return f"ssh {user}@{ip}"


class CallbackModule(CallbackBase):
    CALLBACK_VERSION = 2.0
    CALLBACK_TYPE = 'stdout'
    CALLBACK_NAME = 'jsonl_events'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._path = os.environ.get('JSONL_EVENTS_PATH')
        self._fp = None
        if self._path:
            try:
                self._fp = open(self._path, 'a', buffering=1, encoding='utf-8')
            except OSError:
                self._fp = None

    def _emit(self, event: dict) -> None:
        if not self._fp:
            return
        event.setdefault('ts', _ts())
        try:
            self._fp.write(json.dumps(event, default=str) + '\n')
            self._fp.flush()
            try:
                os.fsync(self._fp.fileno())
            except OSError:
                pass
        except Exception:
            pass

    def v2_playbook_on_play_start(self, play):
        self._emit({'type': 'play_start', 'play': str(play.get_name() or '')})

    def v2_playbook_on_task_start(self, task, is_conditional):
        self._emit({'type': 'task_start', 'task': str(task.get_name() or '')})

    def _summarize_result(self, result):
        try:
            return result._result if hasattr(result, '_result') else {}
        except Exception:
            return {}

    def _host_name(self, result):
        try:
            return str(result._host)
        except Exception:
            return ''

    def _task_name(self, result):
        try:
            return str(result._task.get_name() or '')
        except Exception:
            return ''

    def _task_action(self, result):
        try:
            return str(getattr(result._task, 'action', '') or '')
        except Exception:
            return ''

    def v2_runner_on_ok(self, result):
        task = self._task_name(result)
        host = self._host_name(result)
        res = self._summarize_result(result)
        changed = bool(res.get('changed'))
        msg = res.get('msg') if isinstance(res.get('msg'), str) else ''
        evt = {
            'type': 'task_ok',
            'task': task,
            'host': host,
            'changed': changed,
        }
        if msg:
            evt['msg'] = msg
        self._emit(evt)

        if (
            self._task_action(result) == 'debug'
            and task == 'Show next steps'
            and isinstance(msg, str)
        ):
            m = NEXT_STEPS_RE.search(msg)
            if m:
                vmid = int(m.group(1))
                name = m.group(2)
                ip = m.group(3)
                self._emit({
                    'type': 'result',
                    'vmid': vmid,
                    'name': name,
                    'ip': ip,
                    'sshConfigSnippet': _ssh_config_snippet(name, ip),
                    'sshCommand': _ssh_command(ip),
                })

    def v2_runner_item_on_ok(self, result):
        """Per-iteration result for `loop:` tasks; the actual debug.msg lives here."""
        task = self._task_name(result)
        host = self._host_name(result)
        res = self._summarize_result(result)
        msg = res.get('msg') if isinstance(res.get('msg'), str) else ''
        evt = {
            'type': 'task_ok',
            'task': task,
            'host': host,
            'changed': bool(res.get('changed')),
            'item': True,
        }
        if msg:
            evt['msg'] = msg
        self._emit(evt)

        if (
            self._task_action(result) == 'debug'
            and task == 'Show next steps'
            and isinstance(msg, str)
        ):
            m = NEXT_STEPS_RE.search(msg)
            if m:
                vmid = int(m.group(1))
                name = m.group(2)
                ip = m.group(3)
                self._emit({
                    'type': 'result',
                    'vmid': vmid,
                    'name': name,
                    'ip': ip,
                    'sshConfigSnippet': _ssh_config_snippet(name, ip),
                    'sshCommand': _ssh_command(ip),
                })

    def v2_runner_item_on_failed(self, result):
        res = self._summarize_result(result)
        self._emit({
            'type': 'task_failed',
            'task': self._task_name(result),
            'host': self._host_name(result),
            'msg': str(res.get('msg') or 'item failed'),
            'item': True,
        })

    def v2_runner_on_failed(self, result, ignore_errors=False):
        res = self._summarize_result(result)
        msg = res.get('msg') or res.get('stderr') or 'task failed'
        self._emit({
            'type': 'task_failed',
            'task': self._task_name(result),
            'host': self._host_name(result),
            'msg': str(msg),
        })

    def v2_runner_on_skipped(self, result):
        self._emit({
            'type': 'task_skipped',
            'task': self._task_name(result),
            'host': self._host_name(result),
        })

    def v2_runner_on_unreachable(self, result):
        res = self._summarize_result(result)
        self._emit({
            'type': 'task_failed',
            'task': self._task_name(result),
            'host': self._host_name(result),
            'msg': str(res.get('msg') or 'unreachable'),
        })

    def v2_playbook_on_stats(self, stats):
        for host in sorted(stats.processed.keys()):
            s = stats.summarize(host)
            self._emit({
                'type': 'play_recap',
                'host': str(host),
                'ok': int(s.get('ok', 0)),
                'changed': int(s.get('changed', 0)),
                'failed': int(s.get('failures', 0)),
                'unreachable': int(s.get('unreachable', 0)),
            })
