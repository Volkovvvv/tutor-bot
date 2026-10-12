import { parseSource, selfSource, sourceLabel } from "./source";

describe("parseSource", () => {
  it("достаёт метку из параметра ссылки", () => {
    expect(parseSource("src_tgchat")).toBe("tgchat");
    expect(parseSource(" SRC_Profi-2 ")).toBe("profi-2");
  });

  it("не принимает код приглашения, пустую и длинную метку", () => {
    expect(parseSource("abcdefghjkmnpqrs")).toBeNull();
    expect(parseSource("src_")).toBeNull();
    expect(parseSource(`src_${"a".repeat(32)}`)).toBeNull();
    expect(parseSource(undefined)).toBeNull();
  });

  it("не даёт подделать ответ на вопрос бота: подчёркивание в метке запрещено", () => {
    expect(parseSource("src_self_colleague")).toBeNull();
  });
});

describe("selfSource и sourceLabel", () => {
  it("ответ репетитора хранится с приставкой и подписывается словами", () => {
    expect(selfSource("colleague")).toBe("self_colleague");
    expect(selfSource("toString")).toBeNull();
    expect(sourceLabel("self_colleague")).toBe("от коллеги (ответ)");
  });

  it("метка ссылки подписывается как есть", () => {
    expect(sourceLabel("tgchat")).toBe("ссылка tgchat");
  });
});
