#!/bin/bash

echo "🐴 Starting HiChess..."
echo ""
echo "Starting FastAPI backend on http://localhost:8000"
uvicorn backend:app --reload --port 8000 &
BACKEND_PID=$!

sleep 3

echo "✓ Backend started (PID: $BACKEND_PID)"
echo ""
echo "🎮 Opening game in browser..."
sleep 1

# Open in browser
if command -v open &> /dev/null; then
    open "http://localhost:8000"
elif command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:8000"
else
    echo "Please open: http://localhost:8000"
fi

echo ""
echo "✨ HiChess is ready! Go to http://localhost:8000"
echo "⚙️  Press Ctrl+C to stop the server"
wait $BACKEND_PID

