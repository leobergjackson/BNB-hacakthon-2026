# Emotional Duality Strategy (EDI v2)

An autonomous, self-custodial AI trading agent and CMC Skill that detects cognitive dissonance in crypto markets.

## Project Structure

- **`/emotional-duality-skill/`**: The complete, production-ready CMC Skill package. Includes the signal engine, backtest engine, and a Streamlit demo.
- **`/frontend/`**: A unified Next.js dashboard featuring a stunning UI and the fully embedded interactive Duality Map.
- **`/submission/`**: Contains all documentation, deep-dives, architecture diagrams, and scripts prepared for the DoraHacks submission.

## Getting Started

To view the complete interactive dashboard with the Duality Map:

```bash
# 1. Start the Streamlit backend demo
cd emotional-duality-skill
pip install -r requirements.txt
streamlit run demo.py --server.port 8501

# 2. Start the Next.js frontend (in a separate terminal)
cd frontend
npm install
npm run dev
```
Visit `http://localhost:3000` to view the stunning Hero UI and Interactive Duality Map seamlessly merged into one page!
