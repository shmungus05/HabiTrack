# SpaceCare AI
## AI-Powered Astronaut Health & Wellness Assistant

**Feature:** SpaceCare AI  
**Type:** Conversational AI & Knowledge Retrieval  
**Status:** MVP Specification

## 1. Overview

SpaceCare AI is an AI-powered conversational assistant designed to help astronauts access relevant health, wellness, and daily living guidance during space missions.

Astronauts should be able to communicate naturally with the assistant, describe their concerns, and ask questions.

The AI retrieves relevant information from SpaceLife Library and provides contextual responses with appropriate instructional resources such as videos, GIFs, images, and step-by-step guides.

**Core concept:** Transform astronaut-specific knowledge into accessible, contextual guidance through natural conversation.

## 2. Objectives

- Allow astronauts to communicate naturally with an AI assistant.
- Understand questions and reported discomfort.
- Identify relevant intent and contextual information.
- Retrieve relevant knowledge from SpaceLife Library.
- Recommend appropriate instructional resources.
- Provide contextual follow-up questions.
- Recognize situations requiring medical escalation.
- Ground recommendations in verified resources rather than model assumptions.

## 3. Core Capabilities

### 3.1 Natural Language Interaction

Astronauts should be able to ask questions naturally.

Example inputs:

- "My muscles are sore after exercising."
- "I have trouble sleeping."
- "I feel dizzy."
- "How can I exercise in microgravity?"
- "What can I do to reduce stress?"

The assistant should support conversational follow-up questions and maintain relevant conversation context.

### 3.2 Intent Understanding

The AI should identify the general purpose of each message.

Suggested intent categories:

| Intent | Example |
|---|---|
| Health concern | "My head hurts." |
| Exercise guidance | "How should I exercise?" |
| Sleep guidance | "I cannot sleep." |
| Mental well-being | "I feel stressed." |
| Daily living | "How do I prepare this food?" |
| General question | "How does microgravity affect the body?" |

These categories should be extensible.

### 3.3 Symptom Information Extraction

When an astronaut reports a health concern, the AI should extract relevant information.

Example:

```json
{
  "intent": "health_concern",
  "symptom": "muscle_soreness",
  "body_location": null,
  "severity": null,
  "duration": null,
  "trigger": "after_exercise",
  "additional_context": null
}
```

The AI should:

- Identify reported symptoms.
- Identify the affected body area when available.
- Identify reported severity.
- Identify symptom duration.
- Identify possible triggers.
- Ask follow-up questions when necessary.

Do not assume missing information.

Do not treat extracted information as a medical diagnosis.

### 3.4 Knowledge Retrieval (RAG)

This is the primary integration between SpaceCare AI and SpaceLife Library.

The AI must use the library as its primary source for astronaut-specific educational and instructional recommendations.

#### Retrieval Workflow

1. Receive the astronaut's message.
2. Identify intent and relevant context.
3. Determine whether the message requires safety escalation.
4. Generate relevant search queries.
5. Search SpaceLife Library.
6. Retrieve relevant approved resources.
7. Rank resources by relevance.
8. Validate that retrieved content is appropriate for the user's situation.
9. Generate a grounded response.
10. Return relevant resource references and media.

#### Retrieval Requirements

- Search by title, description, tags, category, and semantic similarity.
- Prioritize approved and relevant resources.
- Respect content approval status.
- Return source attribution.
- Avoid duplicate results.
- Do not invent resources.
- If no relevant resources are found, communicate that clearly.

The AI should not recommend a resource solely because it contains similar keywords.

### 3.5 Instructional Media Recommendations

The assistant should provide more than text.

Depending on the user's question and available approved content, responses may include:

- Instructional videos.
- GIF demonstrations.
- Exercise illustrations.
- Infographics.
- Step-by-step guides.

Example:

**Astronaut:**

"My muscles are sore after exercising."

**AI:**

"I can help you find relevant guidance. First, can you tell me where you're experiencing soreness and how severe it is?"

After gathering context and checking the relevant safety guidance, the AI may display:

**Related Resource: Exercise & Recovery Guide**

- Type: Instructional video.
- Source: NASA.
- Description: Relevant educational information.
- Action: View resource.

The AI must not independently prescribe exercises as treatment for unexplained pain.

### 3.6 Safety & Medical Escalation

This is a mandatory system requirement.

SpaceCare AI is a support and educational tool, not an autonomous medical decision-maker.

The assistant must:

- Never claim to diagnose medical conditions.
- Never independently prescribe medication.
- Never assume symptoms are harmless.
- Recognize potentially serious symptoms.
- Follow approved mission medical procedures.
- Escalate concerning situations to qualified medical personnel.
- Never delay emergency escalation to perform normal knowledge retrieval.
- Never generate unsupported medical instructions.

Medical escalation rules must come from verified, approved mission medical protocols. Do not invent triage thresholds or clinical procedures.

If an appropriate medical protocol is unavailable, the AI should communicate its limitations and direct the astronaut to qualified medical support.

## 4. Conversation Examples

### Scenario A: Muscle Soreness

**Astronaut:**

"I have muscle soreness after exercising."

**Expected AI behavior:**

1. Identify the health-related intent.
2. Ask about the affected area, severity, and duration.
3. Check for concerning symptoms using approved protocols.
4. Retrieve relevant approved exercise and recovery resources.
5. Present appropriate educational information.
6. Display relevant instructional media if available.

### Scenario B: Sleep Difficulties

**Astronaut:**

"I am having trouble sleeping."

**Expected AI behavior:**

1. Identify the sleep-related concern.
2. Ask relevant follow-up questions.
3. Retrieve sleep management resources.
4. Present relevant educational guidance.
5. Display associated resources.

### Scenario C: Microgravity Exercise

**Astronaut:**

"How can I exercise in microgravity?"

**Expected AI behavior:**

1. Identify exercise guidance intent.
2. Search the exercise category.
3. Retrieve relevant approved resources.
4. Display instructional videos or GIFs.
5. Explain the available resource and its source.

### Scenario D: Potential Emergency

**Astronaut:**

"I am experiencing severe chest pain."

**Expected AI behavior:**

1. Recognize a potentially serious concern.
2. Prioritize immediate medical escalation.
3. Direct the astronaut to follow approved mission emergency procedures and contact medical support.
4. Do not recommend ordinary exercise or wellness content.
5. Do not delay escalation while searching the library.

## 5. AI Response Structure

The backend should return structured responses so the frontend can render text, questions, safety information, and media separately.

Example:

```json
{
  "message": "I can help you find relevant guidance.",
  "intent": "health_concern",
  "requires_followup": true,
  "followup_questions": [
    "Where are you experiencing soreness?",
    "How severe is the discomfort?"
  ],
  "safety": {
    "level": "needs_assessment",
    "message": null,
    "escalate": false
  },
  "recommendations": [],
  "resources": []
}
```

Example resource object:

```json
{
  "id": "resource-uuid",
  "title": "Astronaut Exercise Guide",
  "content_type": "video",
  "description": "Exercise educational resource",
  "media_url": null,
  "thumbnail_url": null,
  "source_name": "NASA",
  "source_url": null
}
```

The response schema should be validated by the backend before returning it to the frontend.

Safety decisions must not depend exclusively on an LLM-generated JSON field.

## 6. Functional Requirements

### FR-01: Conversational Interface

Users can send messages and receive AI responses.

### FR-02: Intent Recognition

The AI identifies the general intent of incoming messages.

### FR-03: Symptom Information Extraction

The AI extracts relevant reported symptom information without making diagnoses.

### FR-04: Follow-up Questions

The AI can request additional information when necessary.

### FR-05: Library Retrieval

The AI retrieves relevant resources from SpaceLife Library through its backend API or an approved shared retrieval service.

### FR-06: Resource Recommendation

The AI returns relevant instructional resources with source attribution.

### FR-07: Media Rendering

The frontend displays supported media within the conversation.

### FR-08: Safety Handling

Potentially serious concerns must trigger the approved escalation workflow.

### FR-09: Conversation Context

The AI should maintain relevant context throughout the current conversation.

### FR-10: Retrieval Transparency

The AI should distinguish between:
- Information retrieved from the library.
- General conversational explanations.
- Information that is unavailable or unverified.

## 7. Suggested Technical Architecture

Use the existing project stack wherever possible.

| Component | Suggested Technology |
|---|---|
| Frontend | Next.js |
| Backend | FastAPI |
| AI Model | Gemini API |
| Database | Supabase PostgreSQL |
| Vector Search | pgvector |
| Retrieval | RAG |
| Knowledge Source | SpaceLife Library API |

Avoid unnecessary multi-agent architecture for the MVP.

A single well-designed AI workflow with retrieval, validation, and safety controls is sufficient.

## 8. Integration Requirements

SpaceCare AI must integrate with SpaceLife Library.

The library remains an independent feature.

Integration requirements:

1. Retrieve resources through a defined backend interface.
2. Use actual library resource IDs.
3. Respect resource approval status.
4. Retrieve relevant metadata and media references.
5. Preserve source attribution.
6. Avoid duplicating library content in the AI database.
7. Handle unavailable or failed retrieval gracefully.

The AI should not directly depend on the library's frontend implementation.

## 9. Acceptance Criteria

- [ ] Astronauts can communicate naturally with AI.
- [ ] AI can identify basic user intent.
- [ ] AI can extract reported symptom information.
- [ ] AI can ask contextual follow-up questions.
- [ ] AI can search SpaceLife Library.
- [ ] AI can retrieve relevant approved resources.
- [ ] AI can display videos, GIFs, and images in chat.
- [ ] AI responses include resource attribution.
- [ ] AI does not fabricate resources.
- [ ] AI recognizes potentially serious health concerns.
- [ ] AI follows approved medical escalation rules.
- [ ] AI handles retrieval failures gracefully.
- [ ] AI works with the library without duplicating its data.

## 10. Out of Scope

Do not implement these unless specifically requested:

- Autonomous medical diagnosis.
- Medication prescriptions.
- Real-time biometric monitoring.
- Predictive medical diagnosis.
- Autonomous medical decisions.
- Complex multi-agent systems.
- Mission control integrations.

## 11. Instructions for Coding Agent

Act as a senior AI engineer and software architect.

Before implementation:

1. Inspect the existing repository.
2. Understand the existing AI integration.
3. Identify the available library APIs and data structures.
4. Review the database schema.
5. Understand existing authentication and conversation handling.
6. Identify reusable backend services.

Then propose:

- AI architecture.
- Conversation workflow.
- Intent recognition strategy.
- Symptom information extraction.
- RAG retrieval pipeline.
- Library integration contracts.
- Structured response schema.
- Safety and medical escalation architecture.
- Implementation roadmap.

Do not begin implementation before presenting the proposed plan.

Do not rewrite existing functionality unnecessarily.

Do not introduce unnecessary technologies.

Do not assume the library API exists until you have inspected the repository or its API contract.

**Important:** This feature must remain modular. It should consume SpaceLife Library resources through a defined backend interface rather than tightly coupling the two implementations.

**Product Vision:** SpaceCare AI transforms astronaut-specific knowledge into accessible, contextual guidance through natural conversation.
