import { z } from "zod";

import { REPOSITORY } from "../credits";

const githubRepository = z.object({
  stargazers_count: z.number().int().nonnegative(),
});

export async function fetchStars(signal: AbortSignal): Promise<number | null> {
  try {
    const response = await fetch(`https://api.github.com/repos/${REPOSITORY}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal,
    });
    if (!response.ok) {
      return null;
    }
    const repository = githubRepository.safeParse(await response.json());
    return repository.success ? repository.data.stargazers_count : null;
  } catch {
    return null;
  }
}
