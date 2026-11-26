import type { AgentState } from "../../../../protocol";
import type { RouteEnv } from "../../../options";
import { runProcess } from "../agent-process";
import type { SignInCheck } from "./agent-cli";

const CHECK_TIMEOUT_MS = 5000;

export async function signInState(
  command: string,
  check: SignInCheck | null,
  env: RouteEnv
): Promise<AgentState> {
  if (check === null) {
    return "unchecked";
  }
  if (check.keyEnv !== null && (env[check.keyEnv] ?? "") !== "") {
    return "unchecked";
  }
  const result = await runProcess({
    args: check.args,
    command,
    cwd: process.cwd(),
    env,
    signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    stdin: "",
  });
  if (result.ending !== "exited" || result.startError !== null) {
    return "unchecked";
  }
  return result.code === 0 ? "ready" : "signed-out";
}
