type QueueTask<T> = {
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

export function createRenderQueue(maxConcurrent = 2) {
  let activeCount = 0;
  const pending: QueueTask<unknown>[] = [];

  function dequeue() {
    if (activeCount >= maxConcurrent || pending.length === 0) {
      return;
    }

    const task = pending.shift();
    if (!task) {
      return;
    }

    activeCount += 1;
    void task
      .run()
      .then(task.resolve)
      .catch(task.reject)
      .finally(() => {
        activeCount -= 1;
        dequeue();
      });
  }

  return function enqueue<T>(run: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      pending.push({
        run,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      dequeue();
    });
  };
}

export const pdfThumbnailRenderQueue = createRenderQueue(2);
