import { afterEach, describe, expect, it } from "bun:test";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dir, "../..");
const temporaryDirectories = [];

const cleanEnvironment = () => {
  const env = { ...process.env };
  delete env.OPEN_POS_CLOUD_AUTH_TOKENS;
  delete env.OPEN_POS_CLOUD_AUTH_TOKENS_FILE;
  delete env.OPEN_POS_CLOUD_AUTH_TOKENS_FILE_HOST;
  return env;
};

const renderComposeConfig = (files, env) => {
  const result = spawnSync(
    "docker",
    [
      "compose",
      ...files.flatMap((file) => ["-f", file]),
      "config",
      "--format",
      "json",
    ],
    { cwd: root, env, encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "docker compose config failed");
  }
  return { raw: result.stdout, config: JSON.parse(result.stdout) };
};

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

// `docker compose config` cold-starts the docker CLI on a CI runner, which can
// exceed bun's default 5 s per-test timeout (CI run 33590479279 flaked on it).
const COMPOSE_RENDER_TIMEOUT_MS = 60_000;

describe("Docker Compose cloud authentication", () => {
  it("keeps the mismatched-UID runtime regression in Cloud CI", () => {
    const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
    const cloudJob = workflow.match(
      /\n  cloud-mcp:\n([\s\S]*?)(?=\n  [a-z][a-z-]+:\n|$)/,
    )?.[1];

    expect(cloudJob).toContain("Test owner-only Docker secret handoff");
    expect(cloudJob).toContain(
      "scripts/ci/validate-docker-cloud-secret-runtime.sh",
    );
    expect(
      statSync("scripts/ci/validate-docker-cloud-secret-runtime.sh").mode & 0o111,
    ).toBeGreaterThan(0);
  });

  it("keeps inline token mode executable", () => {
    const token = "inline-compose-token-1234567890";
    const { config } = renderComposeConfig(["docker/compose.yaml"], {
      ...cleanEnvironment(),
      OPEN_POS_CLOUD_AUTH_TOKENS: token,
      OPEN_POS_CLOUD_CORS_ORIGIN: "http://localhost:5173",
    });

    const cloud = config.services["openpos-cloud"];
    expect(cloud.environment).toMatchObject({
      OPEN_POS_CLOUD_AUTH_TOKENS: token,
      OPEN_POS_CLOUD_CORS_ORIGIN: "http://localhost:5173",
    });
    expect(cloud.user).toBeUndefined();
  }, COMPOSE_RENDER_TIMEOUT_MS);

  it("mounts file-backed tokens without copying token bytes into rendered config", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "openpos-compose-secret-"));
    temporaryDirectories.push(directory);
    const tokenFile = path.join(directory, "cloud-tokens.txt");
    const token = "file-compose-token-1234567890";
    writeFileSync(tokenFile, `${token}\n`, { mode: 0o600 });
    chmodSync(tokenFile, 0o600);

    const { raw, config } = renderComposeConfig(
      ["docker/compose.yaml", "docker/compose.secrets.yaml"],
      {
        ...cleanEnvironment(),
        OPEN_POS_CLOUD_AUTH_TOKENS_FILE_HOST: tokenFile,
        OPEN_POS_CLOUD_CORS_ORIGIN: "http://localhost:5173",
      },
    );
    const cloud = config.services["openpos-cloud"];

    expect(raw).not.toContain(token);
    expect(cloud.environment).toMatchObject({
      OPEN_POS_CLOUD_AUTH_TOKENS: "",
      OPEN_POS_CLOUD_AUTH_TOKENS_FILE: "/run/secrets/openpos_cloud_tokens",
    });
    expect(cloud.user).toBe("0:0");
    expect(cloud.secrets).toContainEqual({
      source: "openpos_cloud_tokens",
      target: "openpos_cloud_tokens",
    });
    expect(config.secrets.openpos_cloud_tokens.file).toBe(tokenFile);
  }, COMPOSE_RENDER_TIMEOUT_MS);

  it("mounts the same file-backed token handoff in the HTTPS stack", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "openpos-compose-https-secret-"));
    temporaryDirectories.push(directory);
    const tokenFile = path.join(directory, "cloud-tokens.txt");
    const token = "https-file-compose-token-1234567890";
    writeFileSync(tokenFile, `${token}\n`, { mode: 0o600 });
    chmodSync(tokenFile, 0o600);

    const { raw, config } = renderComposeConfig(
      ["docker/compose.https.yaml", "docker/compose.secrets.yaml"],
      {
        ...cleanEnvironment(),
        OPEN_POS_CLOUD_AUTH_TOKENS_FILE_HOST: tokenFile,
        OPEN_POS_CLOUD_CORS_ORIGIN: "https://openpos.example.com",
        OPEN_POS_CLOUD_DOMAIN: "openpos.example.com",
      },
    );
    const cloud = config.services["openpos-cloud"];

    expect(raw).not.toContain(token);
    expect(cloud.environment).toMatchObject({
      OPEN_POS_CLOUD_AUTH_TOKENS: "",
      OPEN_POS_CLOUD_AUTH_TOKENS_FILE: "/run/secrets/openpos_cloud_tokens",
    });
    expect(cloud.user).toBe("0:0");
    expect(cloud.secrets).toContainEqual({
      source: "openpos_cloud_tokens",
      target: "openpos_cloud_tokens",
    });
    expect(config.secrets.openpos_cloud_tokens.file).toBe(tokenFile);
  }, COMPOSE_RENDER_TIMEOUT_MS);
});
