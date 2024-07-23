import { MultiAgentOrchestrator } from "../src/orchestrator";
import { MockAgent } from "./mock/mockAgent";


describe("Orchestrator", () => {
  
    let orchestrator: MultiAgentOrchestrator;
    let airlinesbotAgent:MockAgent;
    let healthAgent:MockAgent;
    let mathAgent:MockAgent;
    let techAgent:MockAgent;
    let menuRestaurantAgent:MockAgent;

    beforeEach(() => {
        orchestrator = new MultiAgentOrchestrator({
            config: {
              LOG_AGENT_CHAT: true,
              LOG_CLASSIFIER_CHAT: true,
              LOG_CLASSIFIER_RAW_OUTPUT: true,
              LOG_CLASSIFIER_OUTPUT: true,
              LOG_EXECUTION_TIMES: true,
              MAX_MESSAGE_PAIRS_PER_AGENT:10
        
            },
            logger: console,
        
        });

        healthAgent = new MockAgent({
            name: 'Health Agent',
            description: 'Focuses on health and medical topics such as general wellness, nutrition, diseases, treatments, mental health, fitness, healthcare systems, and medical terminology or concepts.'
        });
        orchestrator.addAgent(healthAgent);

        mathAgent = new MockAgent({
            name: 'Math Agent',
            description: 'Math agent is able to performa mathemical computation.'
        });
        orchestrator.addAgent(mathAgent);

        techAgent = new MockAgent({
            name: 'Tech Agent',
            description: 'Specializes in technology areas including software development, hardware, AI, cybersecurity, blockchain, cloud computing, emerging tech innovations, and pricing/costs related to technology products and services.'
        });

        orchestrator.addAgent(techAgent);

        airlinesbotAgent = new MockAgent({
            name: 'AirlinesBot',
            description: 'Helps users book and manage their flight reservation'
        });
        orchestrator.addAgent(airlinesbotAgent);

        menuRestaurantAgent = new MockAgent({
            name: 'menu-restaurant-agent', 
            description: "Agent in charge of providing response to restaurant's menu."
        });
        orchestrator.addAgent(menuRestaurantAgent);


    });

    test(`Test orchestration`, async () => {
        const userId = "userId";
        const sessionId = "sessionId";

        const testSuite = [
            {   agent: airlinesbotAgent,
                userInput:'I need to book a flight',
                expectedAgent: airlinesbotAgent.name,
                expectedResponse:'I see you have a frequent flyer account with us. Can you confirm your frequent flyer number?'
            },
            {   agent: airlinesbotAgent,
                userInput:'34567',
                expectedAgent: airlinesbotAgent.name,
                expectedResponse:'Thank you. And for verification can I get the last four digits of the credit card on file?'
            },
            {   agent: airlinesbotAgent,
                userInput:'3456',
                expectedAgent: airlinesbotAgent.name,
                expectedResponse:'Got it. Let me get some information about your trip. Is this reservation for a one way trip or a round trip?'
            },
            {   agent: techAgent,
                userInput: 'what is aws lambda?',
                expectedAgent: techAgent.name,
                expectedResponse:'AWS Lambda is a serverless compute service that runs your code in response to events and automatically manages the underlying compute resources for you. These events may include changes in state or an update, such as a user placing an item in a shopping cart on an ecommerce website.'
            },
            {   agent: airlinesbotAgent,
                userInput: 'one way',
                expectedAgent: airlinesbotAgent.name,
                expectedResponse: 'Got it. What city are you departing from?'
            },
            {   agent: airlinesbotAgent,
                userInput: 'Paris',
                expectedAgent: airlinesbotAgent.name,
                expectedResponse: "Paris. OK. And, what's your destination?"
            },
            {   agent: mathAgent,
                userInput: 'cosinus 90',
                expectedAgent: mathAgent.name,
                expectedResponse: "0"
            },
            {   agent: airlinesbotAgent,
                userInput: 'London',
                expectedAgent: airlinesbotAgent.name,
                expectedResponse: "Got it. What date would you like to take the flight?"
            },
            {   agent: airlinesbotAgent,
                userInput: 'book a flight tomorrow',
                expectedAgent: airlinesbotAgent.name,
                expectedResponse: "OK. What's the total number of travelers?"
            },
            {   agent: airlinesbotAgent,
                userInput: '5',
                expectedAgent: airlinesbotAgent.name,
                expectedResponse: "Okay. What's your preferred time of departure? You can say something like 8 am"
            },
            {   agent: mathAgent,
                userInput: '5+11',
                expectedAgent: mathAgent.name,
                expectedResponse: "16"
            },
            {   agent: airlinesbotAgent,
                userInput: '5 pm',
                expectedAgent: airlinesbotAgent.name,
                expectedResponse: "Okay. I have flight number A123 departing at 5:30am. The cost of this flight is $100. If you want to proceed with this, just say yes. Otherwise, say, get more options"
            },
            {   agent: airlinesbotAgent,
                userInput: 'yes',
                expectedAgent: airlinesbotAgent.name,
                expectedResponse: "<speak>Can I use the card on file ending in <say-as interpret-as='digits'>3456</say-as> to make the reservation?</speak>"
            },
            {   agent: airlinesbotAgent,
                userInput: 'yes',
                expectedAgent: airlinesbotAgent.name,
                expectedResponse: "<speak>Great. I have you on the B123 to London departing from Paris on 2024-07-16 at 6:30am. Your confirmation code is <say-as interpret-as='digits'>61571</say-as></speak>"
            },
            {   agent: menuRestaurantAgent,
                userInput: "what is the children's menu",
                expectedAgent: menuRestaurantAgent.name,
                expectedResponse: "The children's menu at The Regrettable Experience includes the following entrees: \
1. Chicken nuggets served with ketchup or ranch dressing (contains gluten, possible soy) \
2. Macaroni and cheese (contains dairy, gluten) \
3. Mini cheese quesadillas with salsa (contains dairy, gluten) \
4. Peanut butter and banana sandwich (contains nuts, gluten) \
5. Veggie pita pockets with hummus, cucumber, and tomatoes (contains gluten, possible soy) The children's menu also includes mini cheeseburgers, fish sticks, grilled cheese sandwiches, and spaghetti with marinara sauce. For dessert, the children's menu offers mini ice cream sundaes, fruit kabobs, chocolate chip cookie bites, banana splits, and jello cups."
            },
            {   agent: menuRestaurantAgent,
                userInput: "How much is this menu?",
                expectedAgent: menuRestaurantAgent.name,
                expectedResponse: "It is $10."
            }

            
        ];
        for (const testCase of testSuite) {
            testCase.agent.setAgentResponse(testCase.expectedResponse);
            const response = await orchestrator.routeRequest(testCase.userInput, userId, sessionId);
            expect(response.metadata.agentName).toEqual(testCase.expectedAgent);
            expect(response.output).toEqual(testCase.expectedResponse);
        }
    }, 60000);
    

});
