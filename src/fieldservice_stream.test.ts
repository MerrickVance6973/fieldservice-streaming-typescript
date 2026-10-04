import test from "node:test";
import assert from "node:assert/strict";
import { nextDispatchAction, workOrderSchema } from "./fieldservice_stream.js";

test("on-site work orders ask for a repair result", () => {
  const order = workOrderSchema.parse({
    workOrderId: "WO-7",
    photoNotes: ["panel open"],
    dispatchStatus: "on_site",
    technicianFollowUp: "record voltage"
  });
  assert.equal(nextDispatchAction(order.dispatchStatus), "capture the repair result");
});

test("invalid dispatch status is rejected at the request boundary", () => {
  assert.throws(() => workOrderSchema.parse({
    workOrderId: "WO-8",
    photoNotes: ["door"],
    dispatchStatus: "unknown",
    technicianFollowUp: "call customer"
  }));
});
