import { stat } from "node:fs/promises";
import { basename, dirname } from "node:path";

async function git(cwd: string, ...args: string[]): Promise<string | null> {
  const proc = Bun.spawn(["git", ...args], { cwd, stdout: "pipe", stderr: "ignore" });
  const out = await new Response(proc.stdout).text();
  return (await proc.exited) === 0 ? out.trim() : null;
}

/**
 * When a file's content last changed: the committer date of the last commit that touched it, or the
 * file's own modified time when it has uncommitted changes or was never committed.
 */
export async function lastChanged(path: string): Promise<Date> {
  const cwd = dirname(path);
  const name = basename(path);
  const dirty = await git(cwd, "status", "--porcelain", "--", name);
  if (dirty === "") {
    const committed = await git(cwd, "log", "-1", "--format=%cI", "--", name);
    if (committed) return new Date(committed);
  }
  return (await stat(path)).mtime;
}
