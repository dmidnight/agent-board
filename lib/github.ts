export type NormalizedGitHubRepository = {
  name: string;
  url: string;
  urlKey: string;
};

const REPOSITORY_PART = /^[A-Za-z0-9_.-]+$/;

export function normalizeGitHubRepositoryUrl(
  value: string
): NormalizedGitHubRepository {
  const input = value.trim();
  let owner = "";
  let repository = "";

  const sshMatch = input.match(/^git@github\.com:([^/]+)\/(.+)$/i);
  if (sshMatch) {
    owner = sshMatch[1];
    repository = sshMatch[2];
  } else {
    let parsed: URL;

    try {
      parsed = new URL(input);
    } catch {
      throw new Error("Enter a valid GitHub repository URL.");
    }

    if (
      parsed.protocol !== "https:" ||
      parsed.hostname.toLowerCase() !== "github.com" ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error("Use an HTTPS github.com repository URL.");
    }

    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length !== 2) {
      throw new Error("Use a GitHub repository URL such as owner/repository.");
    }

    [owner, repository] = parts;
  }

  repository = repository.replace(/\.git$/i, "");

  if (
    !owner ||
    !repository ||
    !REPOSITORY_PART.test(owner) ||
    !REPOSITORY_PART.test(repository)
  ) {
    throw new Error("Enter a valid GitHub owner and repository name.");
  }

  const name = `${owner}/${repository}`;
  const url = `https://github.com/${name}`;

  return {
    name,
    url,
    urlKey: url.toLowerCase()
  };
}
