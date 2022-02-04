import { useLayoutEffect, useMemo, useRef, useState } from "react";
import MouseControls from "./MouseControls";
import createDrawingUtils from "./drawingUtils";
import useScrollState from "./useScrollState";
import { openInNewTab } from "../utils/url";

// Processes data; arguably should be moved into Preloader component.
export default function Canvas({
  config,
  editTask,
  maxHeight = Number.MAX_VALUE,
  metadata,
  ownerToImageMap,
  removeTask,
  tasks,
  team,
  width,
}) {
  const {
    AVATAR_SIZE,
    CONTEXT_MENU_HORIZONTAL_OFFSET,
    CONTEXT_MENU_VERTICAL_OFFSET,
    HEADER_HEIGHT,
    MARGIN,
    TOOLTIP_OFFSET,
  } = config;
  const TASK_ROW_HEIGHT = MARGIN + AVATAR_SIZE + MARGIN;

  const {
    drawDependencyConnections,
    drawTaskRow,
    drawUnitGrid,
    drawUnitHeaders,
    getTaskRect,
  } = useMemo(() => createDrawingUtils(config), [config]);

  const naturalHeight = HEADER_HEIGHT + metadata.maxRowIndex * TASK_ROW_HEIGHT;
  const height = Math.min(maxHeight, naturalHeight);

  const canvasRef = useRef();

  const scrollState = useScrollState({
    canvasRef,
    height,
    metadata,
    naturalHeight,
    width,
  });

  const [hoveredTask, setHoveredTask] = useState(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;

    // HACK Expose these values on the global space so that Playwright can use them for e2e tests.
    window.__PLANNER_TEST_ONLY_FIND_TASK_RECT = (taskName) => {
      const task = tasks.find(({ name }) => name === taskName);
      const rect = getTaskRect(task, metadata, width);
      return rect;
    };

    const scale = window.devicePixelRatio;
    canvas.width = Math.floor(width * scale);
    canvas.height = Math.floor(height * scale);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext("2d");
    context.scale(scale, scale);
    context.clearRect(0, 0, width, height);

    // Draw background grid first.
    // This marks off months and weeks.
    drawUnitGrid(context, metadata, scrollState, width, height);

    for (let taskIndex = 0; taskIndex < metadata.tasks.length; taskIndex++) {
      drawTaskRow(
        context,
        taskIndex,
        metadata,
        scrollState,
        team,
        ownerToImageMap,
        width,
        hoveredTask
      );
    }

    // Draw arrows between dependencies.
    metadata.dependenciesMap.forEach((dependentTasks, parentTask) => {
      drawDependencyConnections(
        context,
        dependentTasks,
        parentTask,
        width,
        metadata,
        scrollState
      );
    });

    // Render headers last so they remain visible over top of tasks even after panning.
    drawUnitHeaders(context, metadata, scrollState, width);
  }, [
    // Drawing utils methods
    drawDependencyConnections,
    drawTaskRow,
    drawUnitGrid,
    drawUnitHeaders,
    getTaskRect,

    // Canvas dimenions
    height,
    width,

    // Task/team data
    metadata,
    ownerToImageMap,
    tasks,
    team,

    // Component state
    hoveredTask,
    scrollState,
  ]);

  return (
    <>
      <canvas ref={canvasRef} height={height} width={width} />
      <MouseControls
        canvasRef={canvasRef}
        contextMenuHorizontalOffset={CONTEXT_MENU_HORIZONTAL_OFFSET}
        contextMenuVerticalOffset={CONTEXT_MENU_VERTICAL_OFFSET}
        editTask={editTask}
        findTaskAtPoint={findTaskAtPoint}
        metadata={metadata}
        removeTask={removeTask}
        setActiveTask={setHoveredTask}
        tooltipOffset={TOOLTIP_OFFSET}
      />
    </>
  );
}

function findTaskAtPoint(x, y, metadata) {
  for (let [task, domMetadata] of metadata.taskDOMMetadata) {
    const { isClipped, rect } = domMetadata;

    if (
      x >= rect.x &&
      x <= rect.x + rect.width &&
      y >= rect.y &&
      y <= rect.y + rect.height
    ) {
      return { domMetadata, task };
    }
  }

  return null;
}
