import { Client, createClient } from "@libsql/client";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";
import { SqlChatStorage } from "../../src/storage/sqlChatStorage";
import { ConversationMessage, ParticipantRole } from "../../src/types";
import { Logger } from "../../src/utils/logger";

describe("SqlChatStorage", () => {
  let storage: SqlChatStorage;
  let client: Client;
  let directory: string;
  let url: string;

  const userId = "user1";
  const sessionId = "session1";
  const agentId = "agent1";
  const createMessage = (role: ParticipantRole, text: string): ConversationMessage => ({
    role,
    content: [{ text }],
  });

  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), "agent-squad-sql-"));
    url = pathToFileURL(join(directory, "chat.db")).href;
    storage = new SqlChatStorage(url);
    await storage.waitForInitialization();
    client = createClient({ url });
  });

  afterEach(() => {
    client?.close();
    storage?.close();
    rmSync(directory, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  test("saveChatMessage should commit messages before returning the updated history", async () => {
    const message = createMessage(ParticipantRole.USER, "Hello");

    const history = await storage.saveChatMessage(userId, sessionId, agentId, message);

    const result = await client.execute("SELECT COUNT(*) AS count FROM conversations");
    expect(result.rows[0].count).toBe(1);
    expect(history).toEqual([message]);
  });

  test("saveChatMessage should allow sequential saves without leaving the database locked", async () => {
    const userMessage = createMessage(ParticipantRole.USER, "Hello");
    const assistantMessage = createMessage(ParticipantRole.ASSISTANT, "Hi there");

    await storage.saveChatMessage(userId, sessionId, agentId, userMessage);

    await expect(
      storage.saveChatMessage(userId, sessionId, agentId, assistantMessage)
    ).resolves.toEqual([userMessage, assistantMessage]);
  });

  test("saveChatMessage should persist messages after reopening the database", async () => {
    const message = createMessage(ParticipantRole.USER, "Hello");
    await storage.saveChatMessage(userId, sessionId, agentId, message);
    storage.close();

    storage = new SqlChatStorage(url);
    await storage.waitForInitialization();

    await expect(storage.fetchChat(userId, sessionId, agentId)).resolves.toEqual([message]);
  });

  test("saveChatMessage should commit history trimming with the new message", async () => {
    const messages = [
      createMessage(ParticipantRole.USER, "Hello"),
      createMessage(ParticipantRole.ASSISTANT, "Hi there"),
      createMessage(ParticipantRole.USER, "How are you?"),
      createMessage(ParticipantRole.ASSISTANT, "I'm doing well"),
    ];

    for (const message of messages) {
      await storage.saveChatMessage(userId, sessionId, agentId, message, 2);
    }

    await expect(storage.fetchChat(userId, sessionId, agentId)).resolves.toEqual(messages.slice(-2));
    const result = await client.execute("SELECT COUNT(*) AS count FROM conversations");
    expect(result.rows[0].count).toBe(2);
  });

  test("saveChatMessage should still skip consecutive messages with the same role", async () => {
    const message = createMessage(ParticipantRole.USER, "Hello");
    await storage.saveChatMessage(userId, sessionId, agentId, message);

    await expect(
      storage.saveChatMessage(userId, sessionId, agentId, createMessage(ParticipantRole.USER, "Hello again"))
    ).resolves.toEqual([message]);
    await expect(storage.fetchChat(userId, sessionId, agentId)).resolves.toEqual([message]);
  });

  test("saveChatMessage should roll back and release the writer lock when history trimming fails", async () => {
    jest.spyOn(Logger.logger, "error").mockImplementation(() => {});
    const userMessage = createMessage(ParticipantRole.USER, "Hello");
    const assistantMessage = createMessage(ParticipantRole.ASSISTANT, "Hi there");
    await client.execute({
      sql: `INSERT INTO conversations (
        user_id, session_id, agent_id, message_index, role, content, timestamp
      ) VALUES (?, ?, ?, 0, ?, ?, 0)`,
      args: [userId, sessionId, agentId, userMessage.role, JSON.stringify(userMessage.content)]
    });
    // Fail after the insert so both rollback and writer-lock release are exercised.
    await client.execute(`
      CREATE TRIGGER fail_cleanup BEFORE DELETE ON conversations
      BEGIN
        SELECT RAISE(FAIL, 'cleanup failed');
      END
    `);

    await expect(
      storage.saveChatMessage(userId, sessionId, agentId, assistantMessage, 1)
    ).rejects.toThrow("cleanup failed");
    await expect(storage.fetchChat(userId, sessionId, agentId)).resolves.toEqual([userMessage]);

    await client.execute("DROP TRIGGER fail_cleanup");
    await expect(
      storage.saveChatMessage(userId, sessionId, agentId, assistantMessage)
    ).resolves.toEqual([userMessage, assistantMessage]);
  });
});
