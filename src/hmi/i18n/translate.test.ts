import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { translate, pickLang } from "./translate";

describe("translate", () => {
  it("zh 原样返回，en 查词典缺失回退中文", () => {
    assert.equal(translate("关闭", "zh"), "关闭");
    assert.equal(translate("关闭", "en"), "Close");
    assert.equal(translate("某未翻译串", "en"), "某未翻译串");
  });
  it("占位插值", () => {
    assert.equal(translate("第 {page} / {count} 页", "zh", { page: 2, count: 5 }), "第 2 / 5 页");
  });
});

describe("pickLang（按 Accept-Language 决定语言）", () => {
  it("zh 系 → zh，en 系 → en", () => {
    assert.equal(pickLang("zh-CN,zh;q=0.9,en;q=0.8"), "zh");
    assert.equal(pickLang("en-US,en;q=0.9"), "en");
    assert.equal(pickLang("en"), "en");
    assert.equal(pickLang("zh"), "zh");
  });
  it("非 zh/en 首选 → 回退 zh；空/缺失 → zh", () => {
    assert.equal(pickLang("fr-FR,fr;q=0.9"), "zh");
    assert.equal(pickLang(""), "zh");
    assert.equal(pickLang(null), "zh");
    assert.equal(pickLang(undefined), "zh");
  });
});
