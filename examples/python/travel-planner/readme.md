## ✈️ AI Travel Planner
This Streamlit app is an AI-powered travel planning assistant that helps plan personalized travel itineraries using Claude 3 on Amazon Bedrock. It automates destination research and itinerary planning, creating detailed travel plans tailored to your needs.

### Streamlit App
Here's how the app works:
1. Enter your desired destination
2. Specify the number of days you want to travel
3. Click `Generate Itinerary`
4. Get a detailed, day-by-day travel plan with researched attractions and activities

### Features
- Researches destinations and attractions in real-time using web search
- Generates personalized day-by-day itineraries based on your travel duration
- Provides practical travel suggestions and tips based on current information
- Creates comprehensive travel plans that consider local attractions, activities, and logistics

### How to Get Started?

Check out the [demos README](../README.md) for installation and setup instructions.

### How it Works?

The AI Travel Planner utilizes two main components:
- **ResearcherAgent**: Searches and analyzes real-time information about destinations, attractions, and activities using web search capabilities
- **PlannerAgent**: Takes the researched information and creates a coherent, day-by-day travel itinerary, considering logistics and time management

The agents work together through a supervisor to create a comprehensive travel plan that combines up-to-date destination research with practical itinerary planning.