import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import ReactFlow, {
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  useReactFlow,
  applyNodeChanges,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';

const initialNodes = [
  {
    id: '1',
    data: { label: 'Mindmap Root' },
    position: { x: 100, y: 100 },
    style: {
      backgroundColor: '#f0f0f0',
      padding: 15,
      borderRadius: 8,
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      border: '1px solid #ddd',
    },
  },
];

const initialEdges = [];

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 172;
const nodeHeight = 36;

const getLayoutedElements = (nodes, edges, direction = 'TB') => {
  const layoutNodes = nodes.map((node) => ({
    ...node,
    width: nodeWidth,
    height: nodeHeight,
  }));

  dagreGraph.setGraph({ rankdir: direction });

  layoutNodes.forEach((node) => {
    dagreGraph.setNode(node.id, node);
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  return layoutNodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = direction === 'TB' ? 'top' : 'left';
    node.sourcePosition = direction === 'TB' ? 'bottom' : 'right';
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };
    return node;
  });
};

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const reactFlowWrapper = useRef(null);
  const { setViewport } = useReactFlow();
  const [collapsedNodes, setCollapsedNodes] = useState({});
  const [selectedNode, setSelectedNode] = useState(null);
  const [editingNodeId, setEditingNodeId] = useState(null); // 追加

  useEffect(() => {
    setSelectedNode(nodes[0]);
  }, []);

  const onConnect = useCallback(
    (params) =>
      setEdges((eds) =>
        addEdge(
          { ...params, animated: true, style: { stroke: '#bbb' } },
          eds,
        ),
      ),
    [setEdges],
  );

  const addNode = useCallback(
    (parentNode, isChild) => {
      const id = String(nodes.length + 1);
      const newNode = {
        id,
        data: { label: `New Node ${id}` },
        position: {
          x: Math.random() * 500,
          y: Math.random() * 500,
        },
        style: {
          backgroundColor: '#f0f0f0',
          padding: 15,
          borderRadius: 8,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          border: '1px solid #ddd',
        },
      };
      setNodes((nds) => [...nds, newNode]);

      if (parentNode) {
        setEdges((eds) =>
          addEdge(
            {
              id: `${parentNode.id}-${id}`,
              source: parentNode.id,
              target: id,
              animated: true,
              style: { stroke: '#bbb' },
            },
            eds,
          ),
        );
      }
      return newNode;
    },
    [setNodes, setEdges, nodes],
  );

  const onKeyDown = useCallback(
    (event) => {
      if (!selectedNode) return;

      if (event.key === 'Enter') {
        addNode(selectedNode, false);
      } else if (event.key === 'Tab') {
        addNode(selectedNode, true);
      } else if (event.key === 'ArrowUp') {
        const currentIndex = nodes.findIndex((node) => node.id === selectedNode.id);
        const prevIndex = currentIndex - 1;
        if (prevIndex < 0) return;
        setSelectedNode(nodes[prevIndex]);
      } else if (event.key === 'ArrowDown') {
        const currentIndex = nodes.findIndex((node) => node.id === selectedNode.id);
        const nextIndex = currentIndex + 1;
        if (nextIndex > nodes.length - 1) return;
        setSelectedNode(nodes[nextIndex]);
      } else if (event.key === 'F2') { // F2キーで編集モードに入る
        setEditingNodeId(selectedNode.id);
      }
    },
    [selectedNode, addNode, nodes, setSelectedNode, setEditingNodeId],
  );

  const onRemoveNode = useCallback(() => {
    if (nodes.length > 1) {
      setNodes((nds) => {
        const newNodes = [...nds];
        newNodes.pop();
        return newNodes;
      });
    }
  }, [setNodes, nodes]);

  const onLayout = useCallback(
    (direction) => {
      const layoutedNodes = getLayoutedElements(nodes, edges, direction);
      setNodes(layoutedNodes);
    },
    [nodes, edges, setNodes],
  );

  const onNodeClick = useCallback(
    (event, node) => {
      setSelectedNode(node);
      setCollapsedNodes((prev) => ({
        ...prev,
        [node.id]: !prev[node.id],
      }));

      // 選択されたノードのスタイルのみを更新する
      setNodes((nds) =>
        nds.map((n) =>
          n.id === node.id
            ? { ...n, style: { ...n.style, border: '2px solid #4a90e2' } }
            : { ...n, style: { ...n.style, border: '1px solid #ddd' } }, // 他のノードのボーダーをリセット
        ),
      );
      if (event.detail === 2) { // ダブルクリックで編集モードに入る
        setEditingNodeId(node.id);
      }
    },
    [setCollapsedNodes, setSelectedNode, setNodes, setEditingNodeId],
  );

  const onFitView = useCallback(() => {
    setViewport({ x: 0, y: 0, zoom: 1 });
  }, [setViewport]);

  const visibleNodes = useMemo(() => {
    const collapsedNodeIds = Object.keys(collapsedNodes).filter(
      (key) => collapsedNodes[key],
    );

    const hiddenNodeIds = [];
    edges.forEach((edge) => {
      if (collapsedNodeIds.includes(edge.source)) {
        hiddenNodeIds.push(edge.target);
      }
    });

    return nodes.filter((node) => !hiddenNodeIds.includes(node.id));
  }, [nodes, edges, collapsedNodes]);

  const visibleEdges = useMemo(() => {
    const visibleNodeIds = visibleNodes.map((node) => node.id);
    return edges.filter(
      (edge) =>
        visibleNodeIds.includes(edge.source) &&
        visibleNodeIds.includes(edge.target),
    );
  }, [edges, visibleNodes]);

  const handleNodeDragStop = useCallback((event, node) => {
    setNodes((nds) =>
      applyNodeChanges(
        [
          {
            id: node.id,
            position: { x: node.position.x, y: node.position.y },
          },
        ],
        nds,
      ),
    );
  }, [setNodes]);

  const onNodeLabelChange = useCallback(
    (event, nodeId) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId ? { ...node, data: { label: event.target.value } } : node,
        ),
      );
    },
    [setNodes],
  );

  const onNodeBlur = useCallback(() => {
    setEditingNodeId(null);
  }, [setEditingNodeId]);

  return (
    <div
      style={{ width: '100vw', height: '100vh' }}
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 10,
          display: 'flex',
          gap: 10,
        }}
      >
        <button onClick={onRemoveNode}>Remove Node</button>
        <button onClick={() => onLayout('TB')}>Layout Top-Bottom</button>
        <button onClick={() => onLayout('LR')}>Layout Left-Right</button>
        <button onClick={onFitView}>Fit View</button>
      </div>
      <div
        style={{ width: '100%', height: '100%' }}
        ref={reactFlowWrapper}
      >
        <ReactFlow
          nodes={visibleNodes.map((node) => ({
            ...node,
            data: {
              ...node.data,
              label: (
                editingNodeId === node.id ? (
                  <input
                    type="text"
                    value={node.data.label}
                    onChange={(event) => onNodeLabelChange(event, node.id)}
                    onBlur={onNodeBlur}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === 'Escape') {
                        event.currentTarget.blur();
                      }
                    }}
                    style={{ fontSize: '1rem' }}
                    autoFocus
                  />
                ) : (
                  node.data.label
                )
              ),
            },
            style: {
              backgroundColor:
                node.id === selectedNode?.id
                  ? '#e6f7ff'
                  : collapsedNodes[node.id]
                  ? '#e0e0e0'
                  : node.style.backgroundColor,
              ...node.style,
              border:
                node.id === selectedNode?.id
                  ? '3px solid #1890ff'
                  : node.style.border,
            },
          }))}
          edges={visibleEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          draggable
          onNodeDragStop={handleNodeDragStop}
          onNodeClick={onNodeClick} // onClick を追加
        >
          <Controls />
          <MiniMap />
          <Background variant="dots" gap={12} size={1} />
        </ReactFlow>
      </div>
    </div>
  );
}

export default App;