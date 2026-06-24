export interface RenderLoopOptions {
  /** 重绘回调，timeMs = 自 start 起的经过毫秒；painter 内部按各自周期取相位。 */
  render: (timeMs: number) => void;
  /** 是否存在活动动画（流动/慢闪）。 */
  hasAnimation: () => boolean;
  /** 注入 requestAnimationFrame（测试用假实现）。 */
  raf?: (cb: (t: number) => void) => number;
}

export interface RenderLoop {
  start(): void;
  stop(): void;
  markDirty(): void;
}

export function createRenderLoop(options: RenderLoopOptions): RenderLoop {
  const raf = options.raf ?? ((cb) => requestAnimationFrame(cb));
  let running = false;
  let dirty = false;
  let scheduled = false;
  let startTime: number | null = null;

  const schedule = () => {
    if (!running || scheduled) return;
    scheduled = true;
    raf(tick);
  };

  function tick(t: number) {
    scheduled = false;
    if (!running) return;
    if (startTime === null) startTime = t;
    const animating = options.hasAnimation();
    if (dirty || animating) {
      options.render(t - startTime);
      dirty = false;
    }
    // 仅在有动画时自续轮询；全静止则停轮询，等 markDirty() 唤醒（节能：spec §5）。
    // 契约：调用方在状态变化（含动画开始，如管线起流）时必须调用 markDirty()。
    if (running && animating) schedule();
  }

  return {
    start() {
      if (running) return;
      running = true;
      startTime = null; // 每次 start 相位归零；动画期间勿反复 start，否则相位跳变
      schedule();
    },
    stop() {
      running = false;
    },
    markDirty() {
      dirty = true;
      schedule();
    },
  };
}
