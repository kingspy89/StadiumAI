import { execSync } from 'child_process';
try {
  const pids = execSync('pgrep -f "tsx server.ts"').toString().trim().split('\n');
  const myPid = process.pid.toString();
  for (const pid of pids) {
    if (pid && pid !== myPid) {
      console.log(`Killing phantom process ${pid}`);
      try {
        process.kill(parseInt(pid), 'SIGKILL');
      } catch (e) {
        console.log(`Failed to kill ${pid}: ${e.message}`);
      }
    }
  }
} catch (e) {
  console.log('No phantom processes found or pgrep failed', e.message);
}
