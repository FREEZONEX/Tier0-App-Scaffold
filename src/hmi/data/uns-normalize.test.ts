import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickData, browseChildrenOf, searchToTopics, readToValues, isLeafNode, historyResults } from "./uns-normalize";

const browseResp = {
  data: {
    tree: [
      {
        id: 1, name: "plant", path: "plant", type: "folder", topicType: "",
        children: [
          { id: 2, name: "P-101", path: "plant/P-101", type: "topic", topicType: "json", displayName: "进料泵A",
            fields: [{ name: "rpm", type: "number", unit: "rpm" }],
            payload: { value: { rpm: 90 }, quality: "good", timeStamp: 1700000000 } },
        ],
      },
    ],
  },
};

const searchResp = {
  data: {
    objects: [{ id: 2, name: "P-101", path: "plant/P-101", type: "topic", topicType: "json",
      fields: [{ name: "rpm", type: "number", unit: "rpm" }] }],
    total: 1, page: 1, size: 20,
  },
};

describe("uns-normalize", () => {
  it("pickData 解包 {data:X} 与裸 X", () => {
    assert.deepEqual(pickData({ data: { a: 1 } }), { a: 1 });
    assert.deepEqual(pickData({ a: 1 }), { a: 1 });
    assert.equal(pickData(null), undefined);
  });

  it("browseChildrenOf(path=\"\")：返回查询点的直接子层（顶层根列表），不平铺孙子", () => {
    const topics = browseChildrenOf(browseResp, "");
    assert.deepEqual(topics.map((t) => t.path), ["plant"]); // 不含 plant/P-101（那是孙子层）
    assert.equal(topics[0].hasChildren, true);
  });

  it("browseChildrenOf(path=P)：API 树根=P 自身时取其直接孩子，绝不含 P 自己", () => {
    // 真实 API 形状（2026-06-12 实测）：browse(path=P) 的 tree 根就是 P 节点本身
    const topics = browseChildrenOf(browseResp, "plant");
    assert.deepEqual(topics.map((t) => t.path), ["plant/P-101"]);
    assert.equal(topics[0].displayName, "进料泵A");
    // 爆栈根因回归断言：子列表含 P 自身 → 渲染 walk 无限递归
    assert.ok(!topics.some((t) => t.path === "plant"));
  });

  it("browseChildrenOf(path=P)：maxDepth=1 形状（根=P 无 children）→ 空列表而非 [P 自身]", () => {
    const resp = { data: { tree: [{ id: 1, name: "v1", path: "v1", type: "folder", topicType: "" }] } };
    assert.deepEqual(browseChildrenOf(resp, "v1"), []);
  });

  it("browseChildrenOf(path=P)：树根不是 P（API 直接回孩子列表）→ 原样归一并滤掉 P 自身", () => {
    const resp = {
      data: {
        tree: [
          { id: 1, name: "v1", path: "v1", type: "folder", topicType: "" }, // 混入查询点自身也要滤
          { id: 2, name: "a", path: "v1/a", type: "folder", topicType: "" },
          { id: 3, name: "t", path: "v1/t", type: "topic", topicType: "json" },
        ],
      },
    };
    assert.deepEqual(browseChildrenOf(resp, "v1").map((t) => t.path), ["v1/a", "v1/t"]);
  });

  it("browseChildrenOf 容空/缺字段不崩", () => {
    assert.deepEqual(browseChildrenOf({}, ""), []);
    assert.deepEqual(browseChildrenOf({ data: { tree: [] } }, "x"), []);
  });

  it("懒加载下分支文件夹（type=folder）即便 children 未返回也标 hasChildren", () => {
    // 复现用户反馈 2 根因：maxDepth:1 时下层文件夹 children 没返回，
    // 若按 children 长度判定会被误当叶子；现按 type 判定，folder 始终是分支。
    const resp = {
      data: {
        tree: [
          { id: 1, name: "areaA", path: "plant/areaA", type: "folder", topicType: "" }, // 无 children
          { id: 2, name: "P-101", path: "plant/P-101", type: "topic", topicType: "json", fields: [{ name: "rpm", type: "number" }] },
        ],
      },
    };
    const topics = browseChildrenOf(resp, "plant");
    assert.equal(topics.find((t) => t.path === "plant/areaA")?.hasChildren, true); // 文件夹 → 可展开
    assert.equal(topics.find((t) => t.path === "plant/P-101")?.hasChildren, false); // topic → 叶子可选
  });

  it("isLeafNode：folder→分支，topic/metric/topicType 非空/有 fields→叶子", () => {
    assert.equal(isLeafNode({ type: "folder", topicType: "" }), false);
    assert.equal(isLeafNode({ type: "Folder" }), false); // 大小写不敏感
    assert.equal(isLeafNode({ type: "topic", topicType: "json" }), true);
    assert.equal(isLeafNode({ type: "metric" }), true);
    assert.equal(isLeafNode({ topicType: "json" }), true); // 无 type 但 topicType 非空
    assert.equal(isLeafNode({ fields: [{ name: "x", type: "number" }] }), true); // 有 schema 字段
    assert.equal(isLeafNode({ children: [{ name: "c" }] }), false); // 已加载子节点 → 分支
    assert.equal(isLeafNode({}), true); // 类型未知且无子节点 → 当叶子可选
  });

  it("searchToTopics 返回 items + total/page/size", () => {
    const r = searchToTopics(searchResp);
    assert.equal(r.total, 1);
    assert.equal(r.items.length, 1);
    assert.equal(r.items[0].path, "plant/P-101");
    assert.deepEqual(r.items[0].fields, [{ name: "rpm", type: "number", unit: "rpm" }]);
  });

  it("readToValues 提取各 topic 当前值（JSON 串），跳过失败/无值", () => {
    const resp = {
      data: {
        results: [
          { topic: "t/a", success: true, result: { value: { rpm: 90 } } },
          { topic: "t/b", success: false },
          { topic: "t/c", success: true, result: {} },
        ],
      },
    };
    assert.deepEqual(readToValues(resp), [{ topic: "t/a", valueJson: JSON.stringify({ rpm: 90 }) }]);
    assert.deepEqual(readToValues({}), []);
  });

  it("historyResults 取 results + total（解包 data 信封）", () => {
    const resp = {
      data: {
        total: 3,
        results: [
          { topic: "t/a", success: true, result: { values: [{ timeStamp: 1, value: { v: 1 }, quality: "good" }] } },
        ],
      },
    };
    const r = historyResults(resp);
    assert.equal(r.total, 3);
    assert.equal(r.items.length, 1);
    assert.equal(r.items[0].topic, "t/a");
    assert.deepEqual(historyResults({}), { items: [], total: 0 });
  });

});
