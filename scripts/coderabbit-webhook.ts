import crypto from "node:crypto";
import express, { type Request, type Response } from "express";
import { parseCodeRabbitReview } from "../lib/coderabbit/parseReview";
import { writeReviewState } from "../lib/coderabbit/writeReviewState";

type GitHubReviewPayload = {
  action?: string;
  sender?: {
    login?: string;
  };
  pull_request?: {
    number?: number;
  };
  review?: {
    body?: string;
  };
};

const PORT = 9876;

function verifySignature(req: Request): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    return false;
  }

  const received = req.header("x-hub-signature-256") ?? "";
  if (!received.startsWith("sha256=")) {
    return false;
  }

  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!rawBody) {
    return false;
  }

  const expected = `sha256=${crypto.createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const receivedBuffer = Buffer.from(received, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

async function handleCodeRabbitReview(payload: GitHubReviewPayload): Promise<void> {
  const pr = payload.pull_request?.number;
  const body = payload.review?.body ?? "";
  if (!Number.isInteger(pr) || (pr as number) <= 0) {
    return;
  }

  const parsed = parseCodeRabbitReview(body);
  await writeReviewState(pr as number, parsed);
}

const app = express();
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
    },
  }),
);

app.post("/github-webhook", async (req: Request, res: Response) => {
  if (!verifySignature(req)) {
    res.status(401).send("Unauthorized");
    return;
  }

  const event = req.header("x-github-event");
  const payload = req.body as GitHubReviewPayload;

  const isCodeRabbitReview =
    event === "pull_request_review" &&
    payload.action === "submitted" &&
    payload.sender?.login === "coderabbitai[bot]";

  if (isCodeRabbitReview) {
    await handleCodeRabbitReview(payload);
  }

  res.status(200).send("ok");
});

app.listen(PORT, () => {
  process.stdout.write(`coderabbit-webhook listening on ${PORT}\n`);
});
