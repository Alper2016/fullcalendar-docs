"""
Practical Example: Original vs Enhanced AI Chatbot Service
This example demonstrates the dramatic improvements in intelligence and insights.
"""

from datetime import datetime
from typing import List

# Mock lead data for demonstration
class MockLead:
    def __init__(self, id, score, status, features, feedback_wish, pricing_willingness, created_at):
        self.id = id
        self.score = score
        self.status = status
        self.features = features
        self.feedback_wish = feedback_wish
        self.pricing_willingness = pricing_willingness
        self.created_at = created_at

class MockCampaign:
    def __init__(self, id, name):
        self.id = id
        self.name = name

# Sample lead data
sample_leads = [
    MockLead(1, 9, "qualified", {"ease_of_use": 5, "pricing": 4, "features": 5}, 
             "Would love better mobile support", "$500", datetime(2024, 1, 1)),
    MockLead(2, 7, "contacted", {"ease_of_use": 4, "pricing": 3, "features": 4}, 
             "Great product but expensive", "$300", datetime(2024, 1, 5)),
    MockLead(3, 8, "qualified", {"ease_of_use": 5, "pricing": 5, "features": 4}, 
             "Perfect for our needs", "$400", datetime(2024, 1, 10)),
    MockLead(4, 6, "new", {"ease_of_use": 3, "pricing": 4, "features": 3}, 
             "Could use more features", "$250", datetime(2024, 1, 15)),
    MockLead(5, 9, "qualified", {"ease_of_use": 5, "pricing": 4, "features": 5}, 
             "Excellent solution", "$550", datetime(2024, 1, 20)),
]

sample_campaign = MockCampaign(1, "Q1 Product Launch")

# ===== ORIGINAL CHATBOT RESPONSE EXAMPLE =====
def original_chatbot_response():
    """
    This is what the original chatbot would typically generate:
    Basic stats and generic advice
    """
    return """
    <h3>Campaign Analysis</h3>
    <p>Analyzing 5 leads from campaign "Q1 Product Launch":</p>
    
    <h4>Lead Statistics</h4>
    <ul>
        <li>Total leads: 5</li>
        <li>Average score: 7.8</li>
        <li>Status breakdown: qualified: 3, contacted: 1, new: 1</li>
    </ul>
    
    <h4>Feature Ratings</h4>
    <ul>
        <li>ease_of_use: 4.4/5</li>
        <li>pricing: 4.0/5</li>
        <li>features: 4.2/5</li>
    </ul>
    
    <p>Your leads show good engagement. Consider following up with qualified leads.</p>
    """

# ===== ENHANCED CHATBOT RESPONSE EXAMPLE =====
def enhanced_chatbot_response():
    """
    This is what the enhanced chatbot would generate:
    Advanced insights, trends, predictions, and strategic recommendations
    """
    return """
    <h3>🚀 Strategic Campaign Insights</h3>
    <p><strong>High confidence analysis</strong> from 5 high-quality leads in "Q1 Product Launch"</p>
    
    <h4>📈 Key Performance Indicators</h4>
    <ul>
        <li><strong>Excellent lead quality:</strong> 60% high-score leads (8+) vs industry avg of 30%</li>
        <li><strong>Strong conversion potential:</strong> 3 qualified leads ready for immediate follow-up</li>
        <li><strong>Positive sentiment trend:</strong> 80% positive feedback indicators detected</li>
    </ul>
    
    <h4>🔮 Predictive Insights</h4>
    <ul>
        <li><strong>Conversion forecast:</strong> Expect 1-2 conversions from current qualified leads (30% rate)</li>
        <li><strong>Pricing sweet spot:</strong> $400-$480 range aligns with 80% of price expectations</li>
        <li><strong>Quality trend:</strong> Lead scores improving over time (+15% from early to recent leads)</li>
    </ul>
    
    <h4>💡 Strategic Recommendations</h4>
    <ol>
        <li><strong>Immediate action:</strong> Fast-track the 3 qualified leads - they show high purchase intent</li>
        <li><strong>Product development:</strong> Prioritize mobile support - mentioned by highest-value leads</li>
        <li><strong>Pricing strategy:</strong> Current pricing is acceptable but consider $400-450 sweet spot</li>
        <li><strong>Acquisition scaling:</strong> Excellent lead quality suggests expanding current channels</li>
    </ol>
    
    <h4>⚠️ Risk Assessment</h4>
    <p><strong>Low risk profile</strong> - No significant concerns detected. One lead mentioned cost sensitivity but overall price acceptance is strong.</p>
    
    <h4>🎯 Next Steps</h4>
    <p>Want me to analyze which acquisition channels are performing best, or dive deeper into feature satisfaction patterns?</p>
    """

# ===== CONVERSATION FLOW EXAMPLE =====
def conversation_flow_example():
    """
    Example of how the enhanced chatbot maintains context across multiple questions
    """
    conversations = [
        {
            "user": "What are my key campaign insights?",
            "enhanced_response": enhanced_chatbot_response(),
            "insights_stored": ["Fast-track qualified leads", "Prioritize mobile support", "Pricing sweet spot $400-450"]
        },
        {
            "user": "Tell me more about the pricing insights",
            "enhanced_response": """
            <h3>💰 Detailed Pricing Analysis</h3>
            <p>Building on our previous discussion about your $400-450 pricing sweet spot...</p>
            
            <h4>Price Expectation Distribution</h4>
            <ul>
                <li><strong>Budget-conscious (20%):</strong> $250-300 range - consider entry-level option</li>
                <li><strong>Value-focused (60%):</strong> $400-500 range - your current target market</li>
                <li><strong>Premium segment (20%):</strong> $500+ - opportunity for premium features</li>
            </ul>
            
            <h4>💡 Pricing Strategy Recommendations</h4>
            <ol>
                <li><strong>Immediate:</strong> Test $450 price point with new leads</li>
                <li><strong>Product tiers:</strong> Consider $299 starter and $599 premium options</li>
                <li><strong>Value communication:</strong> Emphasize ROI in messaging to justify pricing</li>
            </ol>
            
            <p>Since you mentioned mobile support earlier, that could be a premium feature differentiator. Want to explore mobile feature monetization strategies?</p>
            """,
            "context_used": ["Previous pricing discussion", "Mobile support insight", "Lead quality data"]
        },
        {
            "user": "What about mobile support opportunities?",
            "enhanced_response": """
            <h3>📱 Mobile Support Strategy</h3>
            <p>Great question! Connecting to our earlier insights about mobile being mentioned by your highest-value leads...</p>
            
            <h4>🎯 Mobile Opportunity Analysis</h4>
            <ul>
                <li><strong>High-value demand:</strong> Requested by 9/10 score leads (premium segment)</li>
                <li><strong>Competitive advantage:</strong> Could justify 15-20% price premium</li>
                <li><strong>Retention impact:</strong> Mobile users typically show 40% higher retention</li>
            </ul>
            
            <h4>🚀 Implementation Roadmap</h4>
            <ol>
                <li><strong>Phase 1 (30 days):</strong> Survey qualified leads on specific mobile needs</li>
                <li><strong>Phase 2 (60 days):</strong> Develop MVP mobile features</li>
                <li><strong>Phase 3 (90 days):</strong> Launch premium mobile tier at $599</li>
            </ol>
            
            <p>This ties perfectly into our pricing strategy discussion - mobile could be your premium differentiator. Ready to dive into acquisition channel optimization next?</p>
            """,
            "context_used": ["Mobile support from earlier", "High-value leads insight", "Pricing strategy connection"]
        }
    ]
    
    return conversations

# ===== SMART ANALYSIS COMPARISON =====
def analysis_comparison():
    """Compare the depth of analysis between original and enhanced versions"""
    
    comparison = {
        "Data Processing": {
            "Original": "Basic aggregation of scores and status",
            "Enhanced": "Trend analysis, sentiment extraction, predictive modeling, risk assessment"
        },
        "Insights Quality": {
            "Original": "Simple statistics and generic advice",
            "Enhanced": "Strategic recommendations with confidence levels and business impact"
        },
        "Context Awareness": {
            "Original": "No memory, each question independent",
            "Enhanced": "Full conversation history, builds on previous insights"
        },
        "Actionability": {
            "Original": "Vague suggestions like 'follow up with leads'",
            "Enhanced": "Specific actions with timelines and expected outcomes"
        },
        "Intelligence Level": {
            "Original": "Reactive Q&A assistant",
            "Enhanced": "Proactive strategic advisor with predictive capabilities"
        }
    }
    
    return comparison

# ===== USAGE EXAMPLE =====
if __name__ == "__main__":
    print("=== AI CHATBOT INTELLIGENCE COMPARISON ===\n")
    
    print("📊 ORIGINAL CHATBOT RESPONSE:")
    print(original_chatbot_response())
    print("\n" + "="*60 + "\n")
    
    print("🧠 ENHANCED CHATBOT RESPONSE:")
    print(enhanced_chatbot_response())
    print("\n" + "="*60 + "\n")
    
    print("💬 CONVERSATION FLOW EXAMPLE:")
    conversations = conversation_flow_example()
    for i, conv in enumerate(conversations, 1):
        print(f"\n--- Turn {i} ---")
        print(f"User: {conv['user']}")
        print(f"Enhanced AI: {conv['enhanced_response'][:200]}...")
        if 'context_used' in conv:
            print(f"Context Used: {conv['context_used']}")
    
    print("\n" + "="*60 + "\n")
    print("📈 INTELLIGENCE COMPARISON:")
    comparison = analysis_comparison()
    for category, details in comparison.items():
        print(f"\n{category}:")
        print(f"  Original: {details['Original']}")
        print(f"  Enhanced: {details['Enhanced']}")