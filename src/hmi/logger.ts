/**
 * HMI 日志门面 —— 集中处理告警/错误，避免散落的 console 调用。
 * 这是本模块唯一允许触达 console 的位置；其余代码一律走这里。
 */
export const logger = {
  warn(message: string): void {
    if (typeof console !== "undefined") {
      console.warn(`[HMI] ${message}`);
    }
  },
  error(message: string, cause?: unknown): void {
    if (typeof console !== "undefined") {
      console.error(`[HMI] ${message}`, cause ?? "");
    }
  },
};
