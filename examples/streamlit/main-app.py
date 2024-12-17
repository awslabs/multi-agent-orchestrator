import imports
import streamlit as st

st.set_page_config(
    page_title="AWS Multi-Agent Orchestrator",
    page_icon="👋",
)

pg = st.navigation(
    [
        st.Page("pages/home.py", title="Home", icon="🏠"),
        st.Page("../movie-production/movie-production-demo.py", title="AI Movie Production Demo" ,icon="🎬"),
    ])
pg.run()