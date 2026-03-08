import test from "node:test";
import assert from "node:assert/strict";
import {
  renderBrokenLine,
  renderCube,
  renderMaze,
  renderPictograph,
  renderRegionCompare,
  renderSymmetry,
  renderVenn
} from "../src/render/visualQuestionRenderer";

const checks = [
  renderMaze(4, { leftTurns: 2, rightTurns: 1 }),
  renderVenn(2, 1, 3),
  renderPictograph([2, 3, 1], { labels: ["A", "B", "C"], valuePerIcon: 2 }),
  renderCube(4),
  renderSymmetry([1, 2, 0, 2]),
  renderBrokenLine([3, 4, 5, 2]),
  renderRegionCompare(60, 90)
];

test("visual assets provide bounded svg and alt text", () => {
  for (const asset of checks) {
    assert.ok(asset.svg.includes("viewBox='0 0 240 120'"));
    assert.ok(asset.svg.startsWith("<svg"));
    assert.ok(asset.altText.length > 6);
  }
});

test("pictograph legend and path metadata are included when needed", () => {
  const pictograph = renderPictograph([1, 2, 3], { valuePerIcon: 5 });
  const maze = renderMaze(8, { leftTurns: 3, rightTurns: 2 });
  assert.ok(pictograph.svg.includes("1 star = 5"));
  assert.ok(maze.altText.includes("left turns"));
  assert.ok(maze.svg.includes("START"));
});
