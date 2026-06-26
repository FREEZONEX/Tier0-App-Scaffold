import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  historyToTrend,
  historyToRows,
  tableColumns,
  valueAtPath,
  cellText,
  chooseTrendInterval,
  nearestPointIndex,
  brushToRange,
  seriesLabel,
  serializeHistory,
  parseHistory,
  alignSeries,
  tablePageCount,
  MAX_TREND_POINTS,
  TABLE_PAGE_SIZE,
  type RawHistoryItem,
} from "./uns-history";

const item = (values: { timeStamp: number; value?: unknown; quality?: string }[]): RawHistoryItem => ({
  topic: "plant/line1/pump",
  success: true,
  result: { values: values.map((v) => ({ quality: "good", ...v })) },
});

describe("historyToTrend", () => {
  it("按 field 抽对象负载里的数值，时间升序", () => {
    const r = historyToTrend(
      item([
        { timeStamp: 2000, value: { temp: 22 } },
        { timeStamp: 1000, value: { temp: 20 } },
      ]),
      "temp",
    );
    assert.deepEqual(r, [
      { t: 1000, v: 20 },
      { t: 2000, v: 22 },
    ]);
  });
  it("聚合结果可能是标量 → 直接取值", () => {
    const r = historyToTrend(item([{ timeStamp: 1000, value: 25 }]), "temp");
    assert.deepEqual(r, [{ t: 1000, v: 25 }]);
  });
  it("非数值 / 缺字段的点被剔除（不产出 NaN）", () => {
    const r = historyToTrend(
      item([
        { timeStamp: 1000, value: { temp: "x" } },
        { timeStamp: 2000, value: { other: 1 } },
        { timeStamp: 3000, value: { temp: 9 } },
      ]),
      "temp",
    );
    assert.deepEqual(r, [{ t: 3000, v: 9 }]);
  });
  it("空 / 失败项 → 空数组", () => {
    assert.deepEqual(historyToTrend({ topic: "t", success: false }, "temp"), []);
  });
});

describe("historyToRows", () => {
  it("整条负载行，时间倒序（新→旧）", () => {
    const rows = historyToRows(
      item([
        { timeStamp: 1000, value: { a: 1 }, quality: "good" },
        { timeStamp: 3000, value: { a: 3 }, quality: "bad" },
        { timeStamp: 2000, value: { a: 2 }, quality: "good" },
      ]),
    );
    assert.deepEqual(
      rows.map((r) => r.t),
      [3000, 2000, 1000],
    );
    assert.equal(rows[1].quality, "good");
    assert.deepEqual(rows[0].payload, { a: 3 });
  });
});

describe("tableColumns", () => {
  it("对象负载顶层 key 并集，首见顺序", () => {
    assert.deepEqual(
      tableColumns([
        { t: 1, quality: "g", payload: { a: 1, b: 2 } },
        { t: 2, quality: "g", payload: { b: 3, c: 4 } },
      ]),
      ["a", "b", "c"],
    );
  });
  it("全标量负载 → 无字段列（[]）", () => {
    assert.deepEqual(tableColumns([{ t: 1, quality: "g", payload: 42 }]), []);
  });
});

describe("valueAtPath", () => {
  it("点分路径深取", () => {
    assert.equal(valueAtPath({ a: { b: 3 } }, "a.b"), 3);
    assert.equal(valueAtPath({ a: 1 }, "a"), 1);
    assert.equal(valueAtPath({ a: 1 }, "x"), undefined);
    assert.equal(valueAtPath(5, ""), 5);
    assert.equal(valueAtPath(null, "a"), undefined);
  });
});

describe("cellText", () => {
  it("标量原样、空值占位、对象 JSON", () => {
    assert.equal(cellText(undefined), "--");
    assert.equal(cellText(null), "--");
    assert.equal(cellText(3), "3");
    assert.equal(cellText("x"), "x");
    assert.equal(cellText(true), "true");
    assert.equal(cellText({ a: 1 }), '{"a":1}');
  });
});

describe("chooseTrendInterval", () => {
  it("选满足点数 ≤ 上限的最小整间隔", () => {
    // 24h，上限 1000：range/1000=86.4s → 最小整间隔 5m，约 288 点
    const r = chooseTrendInterval(24 * 3600 * 1000, 1000);
    assert.equal(r.interval, "5m");
    assert.equal(r.approxPoints, 288);
  });
  it("恰好整除的边界（1m × 1000）", () => {
    const r = chooseTrendInterval(1000 * 60000, 1000);
    assert.equal(r.interval, "1m");
    assert.equal(r.approxPoints, 1000);
  });
  it("任意范围都不超上限", () => {
    for (const ms of [3600e3, 6 * 3600e3, 24 * 3600e3, 7 * 86400e3, 90 * 86400e3]) {
      assert.ok(chooseTrendInterval(ms, MAX_TREND_POINTS).approxPoints <= MAX_TREND_POINTS);
    }
  });
});

describe("nearestPointIndex", () => {
  it("占比映射到最近桶索引并钳制", () => {
    assert.equal(nearestPointIndex(10, 0), 0);
    assert.equal(nearestPointIndex(10, 1), 9);
    assert.equal(nearestPointIndex(10, 1.5), 9);
    assert.equal(nearestPointIndex(10, -1), 0);
    assert.equal(nearestPointIndex(0, 0.5), -1);
    assert.equal(nearestPointIndex(1, 0.5), 0);
  });
});

describe("brushToRange", () => {
  it("占比 → 绝对时间子区间（自动正序）", () => {
    assert.deepEqual(brushToRange(0.2, 0.6, 0, 1000), { startMs: 200, endMs: 600 });
    assert.deepEqual(brushToRange(0.6, 0.2, 0, 1000), { startMs: 200, endMs: 600 });
  });
  it("越界钳制到 [start,end]", () => {
    assert.deepEqual(brushToRange(-0.1, 1.2, 0, 1000), { startMs: 0, endMs: 1000 });
  });
  it("选区过窄 → null（防误触）", () => {
    assert.equal(brushToRange(0.5, 0.505, 0, 1000), null);
  });
});

describe("seriesLabel", () => {
  it("单 topic 用字段名，多 topic 加 topic 短名前缀", () => {
    assert.equal(seriesLabel("plant/line1/pump", "rpm", false), "rpm");
    assert.equal(seriesLabel("plant/line1/pump", "rpm", true), "pump·rpm");
  });
});

describe("serialize/parse history（跨 server fn 边界）", () => {
  it("序列化为 JSON 串再解析，趋势/行结果不变", () => {
    const raw = item([
      { timeStamp: 1000, value: { temp: 20, name: "a" }, quality: "good" },
      { timeStamp: 2000, value: 25, quality: "bad" },
    ]);
    const serial = serializeHistory([raw]);
    assert.equal(typeof serial[0].values[0].valueJson, "string"); // 边界安全
    const back = parseHistory(serial);
    assert.deepEqual(historyToTrend(back[0], "temp"), historyToTrend(raw, "temp"));
    assert.deepEqual(historyToRows(back[0]), historyToRows(raw));
  });
  it("空值序列化为 null（不丢成 undefined 串）", () => {
    const serial = serializeHistory([item([{ timeStamp: 1, value: undefined }])]);
    assert.equal(serial[0].values[0].valueJson, "null");
    assert.equal(parseHistory(serial)[0].result!.values![0].value, null);
  });
});

describe("tablePageCount（表格分页，每页 10）", () => {
  it("每页 10 条", () => {
    assert.equal(TABLE_PAGE_SIZE, 10);
  });
  it("有 total：按 total 取整页数", () => {
    assert.equal(tablePageCount(25, 10, 1, 10), 3);
    assert.equal(tablePageCount(10, 10, 1, 10), 1);
    assert.equal(tablePageCount(0, 0, 1, 10), 1);
  });
  it("API 不回 total：当前页拿满 → 至少允许下一页；未拿满 → 当前页即末页", () => {
    assert.equal(tablePageCount(0, 10, 2, 10), 3);
    assert.equal(tablePageCount(0, 7, 2, 10), 2);
  });
  it("total 与实际矛盾时取大者（已翻到的页不消失）", () => {
    assert.equal(tablePageCount(5, 10, 3, 10), 4);
  });
});

describe("alignSeries", () => {
  it("按时间并集对齐多系列，缺口填 null", () => {
    const r = alignSeries([
      { name: "A", points: [{ t: 1, v: 10 }, { t: 2, v: 20 }] },
      { name: "B", points: [{ t: 2, v: 5 }, { t: 3, v: 7 }] },
    ]);
    assert.deepEqual(r.times, [1, 2, 3]);
    assert.deepEqual(r.columns[0], { name: "A", values: [10, 20, null] });
    assert.deepEqual(r.columns[1], { name: "B", values: [null, 5, 7] });
  });
  it("空输入 → 空时间轴", () => {
    assert.deepEqual(alignSeries([]), { times: [], columns: [] });
  });
});
