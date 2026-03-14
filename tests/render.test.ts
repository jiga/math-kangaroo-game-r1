import test from "node:test";
import assert from "node:assert/strict";
import {
  renderBrokenLine,
  renderCube,
  renderLessonScene,
  renderMaze,
  renderPictograph,
  renderRegionCompare,
  renderSymmetry,
  renderVenn
} from "../src/render/visualQuestionRenderer";
import { formulaVisual, lessonCard } from "../src/content/bands/visuals";
import { allSkillBlueprints } from "../src/learn/conceptLab";

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

test("every Grade 1-2 skill gets a specific concept scene", () => {
  for (const skill of allSkillBlueprints()) {
    const scene = renderLessonScene(skill, 7);
    assert.ok(scene.altText.length > 6);
    assert.notEqual(scene.altText, "General lesson card");
    assert.ok(!scene.svg.includes("Read. Picture. Solve."));
  }
});

test("long lesson text is fitted or wrapped inside svg visuals", () => {
  const formula = formulaVisual(
    ["order matters -> staged count across shrinking choices", "order does not matter -> divide duplicate arrangements"],
    "counting choice"
  );
  const card = lessonCard(
    "Combinatorics and Probability",
    "Interactive lesson cards should keep long titles inside the visual frame instead of spilling out."
  );
  assert.ok(formula.svg.includes("<tspan"), "long formula lines should wrap");
  assert.ok(card.svg.includes("<tspan"), "long lesson card text should wrap");
});
