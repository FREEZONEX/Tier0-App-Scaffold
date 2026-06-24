import type { DataSource } from "./data-source";
import type { PublishMessage } from "../schema/schema";
import { parsePayload } from "./payload";

/**
 * 逐条把操作/控制消息发到 broker（SDK source.publish）。
 *
 * 不写 tag-store、不做任何本地回显：图元只反映 broker 回来的真实数据。
 * 早前这里有「乐观回显」（发布的同时本地写 tag-store 即时点亮图元），
 * 副作用是发布失败时图元仍假装更新出去了——典型「收不到却显示成功」的假象。
 * 命令 topic 与状态 topic 分离时尤其误导。故移除：发布只管发，显示只信真实数据。
 */
export function publishMessages(
  source: Pick<DataSource, "publish"> | null | undefined,
  items: readonly PublishMessage[],
): void {
  if (!source) return;
  for (const item of items) {
    source.publish(item.topic, parsePayload(item.template));
  }
}
