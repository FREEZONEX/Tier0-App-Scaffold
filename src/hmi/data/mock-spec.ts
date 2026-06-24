import type { Mimic, Binding } from "../schema/schema";
import type { MockTopicSpec } from "./mock-source";

interface Field {
  readonly path: string;
  readonly kind: "number" | "boolean";
}

const BOOL_KEYS = ["running", "open", "closed", "alarm", "interlock", "on", "active"];

function kindForKey(key: string): "number" | "boolean" {
  return BOOL_KEYS.includes(key.toLowerCase()) ? "boolean" : "number";
}

/** 收集每个 topic 下需要产出的字段（来自节点 bindings 的 key + path，及 edge.flowBy）。 */
function collectFields(mimic: Mimic): Map<string, Field[]> {
  const byTopic = new Map<string, Field[]>();
  const add = (binding: Binding, kind: "number" | "boolean") => {
    const list = byTopic.get(binding.topic) ?? [];
    if (!list.some((f) => f.path === binding.path)) list.push({ path: binding.path, kind });
    byTopic.set(binding.topic, list);
  };
  for (const node of mimic.nodes) {
    for (const [key, binding] of Object.entries(node.bindings)) {
      add(binding, kindForKey(key));
    }
    // 额外数据点（watch）的字段也产仿真值 —— 演示/预览里贴身读数（如塔身多塔盘温度）才会动。
    for (const w of node.watches ?? []) {
      add({ topic: w.topic, path: w.path }, "number");
    }
    for (const topic of node.topics) {
      if (!byTopic.has(topic)) byTopic.set(topic, []);
    }
  }
  for (const edge of mimic.edges) {
    if (edge.flowBy) add(edge.flowBy, "number");
  }
  return byTopic;
}

/**
 * topic 名 → 稳定相位种子（FNV-1a 哈希）。让不同 topic 的仿真值彼此错开：
 * 否则相位只按「同一 topic 内字段序号 i」区分，单字段 topic（i 恒为 0）会全部同步成同一个数，
 * 演示/预览里每个元件读数都一样（看起来像绑了同一个 topic）。
 */
function topicSeed(topic: string): number {
  let h = 2166136261;
  for (let i = 0; i < topic.length; i++) {
    h ^= topic.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h % 997); // 0..996，跨 topic 拉开正弦/翻转相位
}

/** 禁止的路径 token，防止用户 schema 的 path 污染原型链。 */
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** 按路径写入嵌套对象（支持 a.b 点路径，简化：仅点路径）。含原型污染守卫：遇危险 token 整条跳过。 */
function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const tokens = path.split(".");
  if (tokens.some((t) => FORBIDDEN_KEYS.has(t))) return;
  let cur = target;
  for (let i = 0; i < tokens.length - 1; i++) {
    const t = tokens[i];
    if (typeof cur[t] !== "object" || cur[t] === null) cur[t] = {};
    cur = cur[t] as Record<string, unknown>;
  }
  cur[tokens[tokens.length - 1]] = value;
}

/**
 * 从 schema 生成确定性 mock：number 字段走正弦游走，boolean 字段按相位周期翻转。
 * 用每个字段在 topic 内的序号制造相位差，避免所有值同步。
 */
export function mockSpecsFromSchema(mimic: Mimic): MockTopicSpec[] {
  const byTopic = collectFields(mimic);
  const specs: MockTopicSpec[] = [];
  for (const [topic, fields] of byTopic) {
    const seed = topicSeed(topic); // 跨 topic 相位错开（同一 topic 内再按字段序号 i 错开）
    specs.push({
      topic,
      shape: (t: number) => {
        const payload: Record<string, unknown> = {};
        // 布尔态取稳定值（不随 t 翻转）：演示是稳态工厂快照，设备每几秒翻转「跳灯」既不真实也分散注意；
        // 约 3/4 处于运行/在位态。同时探测本 topic 的「运行」布尔，供下方转速类数值联动。
        let running: boolean | null = null; // null = 本 topic 无运行布尔
        fields.forEach((field, i) => {
          if (field.kind !== "boolean") return;
          const v = (seed + i) % 4 !== 0;
          setPath(payload, field.path, v);
          if (/^(run|running|on|active|start)/i.test(field.path)) running = v;
        });
        // 数值正弦游走；但「转速/频率」类在停机时归零——否则会出现「图元灰停却显 91.7 rpm」的自相矛盾。
        fields.forEach((field, i) => {
          if (field.kind === "boolean") return;
          const speedLike = /rpm|speed|freq|hz|rev/i.test(field.path);
          if (speedLike && running === false) {
            setPath(payload, field.path, 0);
          } else {
            const value = 50 + 45 * Math.sin((t + seed + i * 7) / 10);
            setPath(payload, field.path, Math.round(value * 10) / 10);
          }
        });
        return payload;
      },
    });
  }
  return specs;
}
