import os
import sys
import json
import unittest
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.main import health_check
import app.main as main_mod


class TestMongoDBFailsafe(unittest.TestCase):
    """Test production MongoDB failsafe and healthcheck behaviors."""

    def test_healthcheck_returns_healthy_when_connected_or_local_mock(self):
        """When REQUIRE_MONGODB is false or db is connected, /health returns 200 dict."""
        res = health_check()
        # Returns regular dict with status: healthy
        self.assertIsInstance(res, dict)
        self.assertEqual(res["status"], "healthy")
        self.assertIn("database", res)

    def test_healthcheck_returns_503_when_required_and_disconnected(self):
        """When REQUIRE_MONGODB is true and is_connected is False, /health returns HTTP 503."""
        orig_req = main_mod.REQUIRE_MONGODB
        orig_conn = main_mod.is_connected
        try:
            main_mod.REQUIRE_MONGODB = True
            main_mod.is_connected = False

            res = health_check()
            self.assertEqual(getattr(res, "status_code", None), 503)
            body = json.loads(res.body.decode("utf-8"))
            self.assertEqual(body["status"], "unhealthy")
            self.assertEqual(body["database"], "disconnected")
        finally:
            main_mod.REQUIRE_MONGODB = orig_req
            main_mod.is_connected = orig_conn

    def test_database_module_raises_runtime_error_when_required_and_unreachable(self):
        """When REQUIRE_MONGODB=true and connection fails, database initialization raises RuntimeError."""
        import subprocess

        cmd = [
            sys.executable,
            "-c",
            "import os; os.environ['REQUIRE_MONGODB']='true'; os.environ['MONGODB_URL']='mongodb://invalid.host.unreachable:27017'; os.environ['MONGODB_TIMEOUT_MS']='300'; from app import database"
        ]
        proc = subprocess.run(cmd, cwd=str(backend_dir), capture_output=True, text=True)
        self.assertNotEqual(proc.returncode, 0, "Subprocess should fail when REQUIRE_MONGODB=true and host unreachable")
        self.assertIn("RuntimeError", proc.stderr)
        self.assertIn("REQUIRE_MONGODB=true", proc.stderr)


if __name__ == "__main__":
    unittest.main()
