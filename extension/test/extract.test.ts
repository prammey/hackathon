import { describe, expect, it } from "vitest";
import { candidatesFromText, detectFormat, userTextFromChatGPT, userTextFromClaude } from "../src/options/extract";

describe("candidatesFromText", () => {
  it("keeps memory-style bullets and self-descriptions, drops secrets and duplicates", () => {
    const text = "- Lives in Leeds\n- Lives in Leeds\n- My PIN is 1234\nI'm a retired nurse. The weather is nice.\n- Card 4111 1111 1111 1111";
    expect(candidatesFromText(text, "t").map((c) => c.text)).toEqual(["Lives in Leeds", "I'm a retired nurse."]);
  });
});

describe("export parsers", () => {
  const chatgpt = [{ title: "T", current_node: "b", mapping: {
    r: { parent: null, message: null },
    a: { parent: "r", message: { author: { role: "user" }, content: { parts: ["I live in Bath."] } } },
    x: { parent: "a", message: { author: { role: "user" }, content: { parts: ["(edited away branch)"] } } },
    m: { parent: "a", message: { author: { role: "assistant" }, content: { parts: ["I am an AI."] } } },
    b: { parent: "m", message: { author: { role: "user" }, content: { parts: ["I prefer large text."] } } },
  } }];
  it("ChatGPT: follows the visible branch and keeps only the user's messages", () => {
    expect(detectFormat(chatgpt)).toBe("chatgpt");
    expect(userTextFromChatGPT(chatgpt)[0].text).toBe("I live in Bath.\nI prefer large text.");
  });
  it("Claude: keeps only human messages", () => {
    const claude = [{ name: "N", chat_messages: [{ sender: "human", text: "I'm 80." }, { sender: "assistant", text: "I'm Claude." }] }];
    expect(detectFormat(claude)).toBe("claude");
    expect(userTextFromClaude(claude)[0].text).toBe("I'm 80.");
  });
});
