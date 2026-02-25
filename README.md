# CODECRAWLER - D&D AI Agent System

A sophisticated multi-agent orchestration system designed to demonstrate advanced AI coordination patterns. This project showcases how multiple specialized AI agents can work together to dynamically generate and manage Dungeons & Dragons narratives.

## Project Vision

**AI Lab** was built as an educational exploration into **multi-level orchestrated coding agents**. Rather than relying on a single monolithic AI model, this system breaks down complex D&D narrative generation into specialized agent responsibilities, each handling distinct aspects of the storytelling process.

### Key Agents

- **Narrative Agent** - Generates engaging story sequences and plot developments
- **Rules Agent** - Ensures game mechanics compliance and validates rule interactions
- **State Agent** - Manages game state consistency and tracks character/world changes

## Architecture

### Tech Stack

- **Backend**: Node.js + TypeScript with Express
- **Frontend**: Angular with Nginx
- **Database**: PostgreSQL
- **AI Integration**: Google Gemini API
- **Containerization**: Docker & Docker Compose

### Project Structure


## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local development)
- Google Gemini API key

### Environment Setup

1. Create `.env` file in the project root:
```env
GEMINI_API_KEY=your_actual_api_key_here
```

2. Start the application:
```
docker compose up --build
```

3. Access the application:
Access the application:

Frontend: http://localhost
Backend API: http://localhost:3000
Local Development
Backend:
```
cd backend
npm install
npm run dev
```

**Learning Outcomes**

This project demonstrates:

Agent-Based Architecture: Breaking down AI tasks into specialized, focused agents
Multi-Level Orchestration: Coordinating between multiple agents with shared state
Type Safety: Using TypeScript for robust, maintainable code
Containerization: Production-ready Docker deployment
Database Management: PostgreSQL with migrations for schema versioning

**Overview**

Narrative generation and management
Game state queries and updates
Rules validation and enforcement
Authentication & authorization
Development Notes
This codebase is structured to prioritize clarity and educational value over minimal lines of code. Comments and agent separation make it ideal for understanding how complex AI workflows can be organized at scale.

**License**

Built as an educational project to explore multi-agent AI orchestration patterns.