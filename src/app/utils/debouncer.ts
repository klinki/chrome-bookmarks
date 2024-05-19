// Copyright 2017 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {TimerProxy} from "../services/types";

// Copyright 2016 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
class PromiseResolver<T> {
  private resolve_: (resolution: T) => void;
  private reject_: (reason?: any) => void;
  private promise_: Promise<T>;
  private isFulfilled_ = false;

  constructor() {
    this.resolve_ = () => {
    };
    this.reject_ = () => {
    };
    this.isFulfilled_ = false;
    this.promise_ = new Promise(((resolve, reject) => {
      this.resolve_ = resolution => {
        resolve(resolution);
        this.isFulfilled_ = true
      };
      this.reject_ = reason => {
        reject(reason);
        this.isFulfilled_ = true
      }
    }))
  }

  get isFulfilled() {
    return this.isFulfilled_
  }

  get promise() {
    return this.promise_
  }

  get resolve() {
    return this.resolve_
  }

  get reject() {
    return this.reject_
  }
}


/**
 * @fileoverview A debouncer which fires the given callback after a delay. The
 * delay can be refreshed by calling restartTimeout. Resetting the timeout with
 * no delay moves the callback to the end of the task queue.
 */

export class Debouncer {
  private callback: () => void;
  private timer: number|null = null;
  private timerProxy: TimerProxy;
  private boundTimerCallback: () => void;
  private isDone: boolean = false;
  private promiseResolver: PromiseResolver<void>;

  constructor(callback: () => void) {
    this.callback = callback;
    this.timerProxy = window;
    this.boundTimerCallback = this.timerCallback_.bind(this);
    this.promiseResolver = new PromiseResolver();
  }

  /**
   * Starts the timer for the callback, cancelling the old timer if there is
   * one.
   */
  restartTimeout(delay?: number) {
    this.cancelTimeout_();
    this.timer =
      this.timerProxy.setTimeout(this.boundTimerCallback, delay || 0);
  }

  done(): boolean {
    return this.isDone;
  }

  get promise(): Promise<void> {
    return this.promiseResolver.promise;
  }

  /**
   * Resets the debouncer as if it had been newly instantiated.
   */
  reset() {
    this.isDone = false;
    this.promiseResolver = new PromiseResolver();
    this.cancelTimeout_();
  }

  /**
   * Cancel the timer callback, which can be restarted by calling
   * restartTimeout().
   */
  private cancelTimeout_() {
    if (this.timer) {
      this.timerProxy.clearTimeout(this.timer);
    }
  }

  private timerCallback_() {
    this.isDone = true;
    this.callback.call(this);
    this.promiseResolver.resolve();
  }
}
