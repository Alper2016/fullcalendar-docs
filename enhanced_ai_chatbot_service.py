import logging
import re
import json
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Set, Optional, Any
from collections import defaultdict, Counter
from dataclasses import dataclass, field

import requests

from applications.leads.models import Lead, Campaign
from project.settings import GEMINI_API_KEY

logger = logging.getLogger(__name__)


@dataclass
class ConversationMemory:
    """Tracks conversation context and user preferences"""
    user_id: str
    session_id: str
    conversation_history: List[Dict[str, str]] = field(default_factory=list)
    user_preferences: Dict[str, Any] = field(default_factory=dict)
    last_analysis_type: Optional[str] = None
    previous_insights: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)

    def add_interaction(self, question: str, response: str, analysis_type: str = None):
        self.conversation_history.append({
            'timestamp': datetime.now().isoformat(),
            'question': question,
            'response': response,
            'analysis_type': analysis_type
        })
        if analysis_type:
            self.last_analysis_type = analysis_type
        
        # Keep only last 10 interactions to manage memory
        if len(self.conversation_history) > 10:
            self.conversation_history.pop(0)

    def get_context_summary(self) -> str:
        if not self.conversation_history:
            return ""
        
        recent_topics = []
        for interaction in self.conversation_history[-3:]:  # Last 3 interactions
            if interaction.get('analysis_type'):
                recent_topics.append(interaction['analysis_type'])
        
        if recent_topics:
            return f"Recent conversation topics: {', '.join(set(recent_topics))}"
        return ""


@dataclass
class AdvancedInsights:
    """Container for advanced analytics insights"""
    trends: Dict[str, Any] = field(default_factory=dict)
    predictions: Dict[str, Any] = field(default_factory=dict)
    recommendations: List[str] = field(default_factory=list)
    sentiment_analysis: Dict[str, Any] = field(default_factory=dict)
    comparative_analysis: Dict[str, Any] = field(default_factory=dict)
    risk_factors: List[str] = field(default_factory=list)


class EnhancedAIChatbotService:
    """Enhanced AI Chatbot Service with advanced analytics and conversation memory"""
    
    API_CONFIGS = [
        {
            "url": f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}",
            "name": "Gemini 2.0 Flash"
        },
        {
            "url": f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}",
            "name": "Gemini 1.5 Flash"
        },
        {
            "url": f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key={GEMINI_API_KEY}",
            "name": "Gemini 1.5 Pro"
        }
    ]

    # In-memory conversation storage (in production, use Redis or database)
    _conversation_memory: Dict[str, ConversationMemory] = {}

    @classmethod
    def get_or_create_memory(cls, user_id: str, session_id: str) -> ConversationMemory:
        """Get or create conversation memory for a user session"""
        key = f"{user_id}_{session_id}"
        if key not in cls._conversation_memory:
            cls._conversation_memory[key] = ConversationMemory(user_id=user_id, session_id=session_id)
        return cls._conversation_memory[key]

    @staticmethod
    def generate_enhanced_lead_context(lead_data: List[Lead], campaign: Campaign, 
                                     memory: ConversationMemory = None) -> str:
        """Generate enhanced context with advanced analytics"""
        if not lead_data:
            return "No lead data available."

        total_leads = len(lead_data)
        context = f'Analyzing {total_leads} leads from campaign "{campaign.name}":\n\n'

        # Add conversation context if available
        if memory and memory.get_context_summary():
            context += f"=== CONVERSATION CONTEXT ===\n{memory.get_context_summary()}\n\n"

        # Generate advanced insights
        insights = EnhancedAIChatbotService._generate_advanced_insights(lead_data, campaign)
        
        # Basic lead information (condensed for intelligence)
        context += "=== LEAD OVERVIEW ===\n"
        context += EnhancedAIChatbotService._generate_lead_summary(lead_data)
        
        # Advanced analytics
        context += "\n=== ADVANCED ANALYTICS ===\n"
        context += EnhancedAIChatbotService._format_advanced_insights(insights)
        
        # Historical trends if we have memory
        if memory and memory.previous_insights:
            context += "\n=== HISTORICAL INSIGHTS ===\n"
            context += f"Previous key insights: {', '.join(memory.previous_insights[-3:])}\n"

        return context

    @staticmethod
    def _generate_lead_summary(lead_data: List[Lead]) -> str:
        """Generate a concise lead summary focused on key metrics"""
        context = ""
        
        # Quick stats
        total_leads = len(lead_data)
        high_score_leads = len([l for l in lead_data if hasattr(l, 'score') and l.score >= 8])
        
        context += f"Total Leads: {total_leads}\n"
        context += f"High-Quality Leads (8+ score): {high_score_leads} ({(high_score_leads/total_leads)*100:.1f}%)\n"
        
        # Status distribution (condensed)
        status_counts = Counter([getattr(l, 'status', 'unknown') for l in lead_data])
        context += f"Status Breakdown: {dict(status_counts)}\n"
        
        # Score statistics
        scores = [l.score for l in lead_data if hasattr(l, 'score') and l.score > 0]
        if scores:
            avg_score = sum(scores) / len(scores)
            context += f"Average Score: {avg_score:.1f} (Range: {min(scores)}-{max(scores)})\n"
        
        return context

    @staticmethod
    def _generate_advanced_insights(lead_data: List[Lead], campaign: Campaign) -> AdvancedInsights:
        """Generate advanced insights including trends, predictions, and recommendations"""
        insights = AdvancedInsights()
        
        # Trend Analysis
        insights.trends = EnhancedAIChatbotService._analyze_trends(lead_data)
        
        # Sentiment Analysis
        insights.sentiment_analysis = EnhancedAIChatbotService._analyze_sentiment(lead_data)
        
        # Predictive Insights
        insights.predictions = EnhancedAIChatbotService._generate_predictions(lead_data)
        
        # Strategic Recommendations
        insights.recommendations = EnhancedAIChatbotService._generate_recommendations(lead_data, insights)
        
        # Risk Factors
        insights.risk_factors = EnhancedAIChatbotService._identify_risk_factors(lead_data)
        
        return insights

    @staticmethod
    def _analyze_trends(lead_data: List[Lead]) -> Dict[str, Any]:
        """Analyze trends in lead data"""
        trends = {}
        
        # Score trends over time
        dated_leads = []
        for lead in lead_data:
            date_str = EnhancedAIChatbotService._get_lead_date(lead)
            if date_str and hasattr(lead, 'score'):
                try:
                    # Parse date (assuming ISO format or similar)
                    date = datetime.fromisoformat(date_str.split('.')[0])  # Remove microseconds
                    dated_leads.append((date, lead.score))
                except:
                    continue
        
        if len(dated_leads) >= 3:  # Need at least 3 points for trend
            dated_leads.sort(key=lambda x: x[0])
            recent_scores = [score for _, score in dated_leads[-10:]]  # Last 10 leads
            early_scores = [score for _, score in dated_leads[:10]]   # First 10 leads
            
            if early_scores and recent_scores:
                early_avg = sum(early_scores) / len(early_scores)
                recent_avg = sum(recent_scores) / len(recent_scores)
                trend_direction = "improving" if recent_avg > early_avg else "declining"
                trends['score_trend'] = {
                    'direction': trend_direction,
                    'early_avg': round(early_avg, 1),
                    'recent_avg': round(recent_avg, 1),
                    'change': round(recent_avg - early_avg, 1)
                }
        
        # Feature preference trends
        feature_popularity = defaultdict(list)
        for lead in lead_data:
            if hasattr(lead, 'features') and lead.features:
                for feature, rating in lead.features.items():
                    feature_popularity[feature].append(rating)
        
        if feature_popularity:
            top_features = sorted(
                [(f, sum(ratings)/len(ratings)) for f, ratings in feature_popularity.items()],
                key=lambda x: x[1], reverse=True
            )
            trends['top_features'] = top_features[:3]  # Top 3 features
        
        return trends

    @staticmethod
    def _analyze_sentiment(lead_data: List[Lead]) -> Dict[str, Any]:
        """Analyze sentiment from lead feedback and comments"""
        sentiment_data = {
            'positive_indicators': 0,
            'negative_indicators': 0,
            'neutral_indicators': 0,
            'key_themes': []
        }
        
        # Keywords for sentiment analysis
        positive_keywords = ['great', 'excellent', 'love', 'amazing', 'perfect', 'wonderful', 
                           'fantastic', 'impressed', 'satisfied', 'happy', 'pleased']
        negative_keywords = ['bad', 'terrible', 'hate', 'awful', 'disappointing', 'frustrated',
                           'annoying', 'confusing', 'difficult', 'poor', 'unsatisfied']
        
        all_feedback = []
        
        for lead in lead_data:
            feedback_texts = []
            
            # Collect feedback from various fields
            if hasattr(lead, 'feedback_wish') and lead.feedback_wish:
                feedback_texts.append(str(lead.feedback_wish).lower())
            if hasattr(lead, 'feedback_features') and lead.feedback_features:
                feedback_texts.append(str(lead.feedback_features).lower())
            if hasattr(lead, 'dynamic_fields') and lead.dynamic_fields:
                for key, value in lead.dynamic_fields.items():
                    if 'feedback' in key.lower() or 'comment' in key.lower():
                        feedback_texts.append(str(value).lower())
            
            for text in feedback_texts:
                all_feedback.append(text)
                
                # Simple sentiment scoring
                positive_count = sum(1 for word in positive_keywords if word in text)
                negative_count = sum(1 for word in negative_keywords if word in text)
                
                if positive_count > negative_count:
                    sentiment_data['positive_indicators'] += 1
                elif negative_count > positive_count:
                    sentiment_data['negative_indicators'] += 1
                else:
                    sentiment_data['neutral_indicators'] += 1
        
        # Extract key themes (simple keyword extraction)
        if all_feedback:
            all_text = ' '.join(all_feedback)
            # Find common words that appear multiple times
            words = re.findall(r'\b\w{4,}\b', all_text)  # Words with 4+ characters
            word_freq = Counter(words)
            common_themes = [word for word, count in word_freq.most_common(5) if count > 1]
            sentiment_data['key_themes'] = common_themes
        
        return sentiment_data

    @staticmethod
    def _generate_predictions(lead_data: List[Lead]) -> Dict[str, Any]:
        """Generate predictive insights based on current data patterns"""
        predictions = {}
        
        # Conversion likelihood based on scores
        high_score_leads = [l for l in lead_data if hasattr(l, 'score') and l.score >= 8]
        medium_score_leads = [l for l in lead_data if hasattr(l, 'score') and 5 <= l.score < 8]
        
        total_leads = len(lead_data)
        if total_leads > 0:
            high_score_percentage = len(high_score_leads) / total_leads * 100
            predictions['conversion_forecast'] = {
                'high_potential_leads': len(high_score_leads),
                'high_potential_percentage': round(high_score_percentage, 1),
                'predicted_conversions': max(1, round(len(high_score_leads) * 0.3)),  # Assume 30% conversion
                'follow_up_priority': len(medium_score_leads)
            }
        
        # Price optimization predictions
        prices = []
        for lead in lead_data:
            price = EnhancedAIChatbotService._extract_price_from_lead(lead)
            if price:
                match = re.search(r'\$?(\d+(\.\d+)?)', str(price))
                if match:
                    value = float(match.group(1))
                    if value > 0:
                        prices.append(value)
        
        if len(prices) >= 3:
            avg_price = sum(prices) / len(prices)
            predictions['pricing_insights'] = {
                'sweet_spot_range': f"${avg_price * 0.8:.0f} - ${avg_price * 1.2:.0f}",
                'average_expectation': f"${avg_price:.0f}",
                'price_sensitive_leads': len([p for p in prices if p < avg_price * 0.7])
            }
        
        return predictions

    @staticmethod
    def _generate_recommendations(lead_data: List[Lead], insights: AdvancedInsights) -> List[str]:
        """Generate strategic recommendations based on insights"""
        recommendations = []
        
        # Score-based recommendations
        scores = [l.score for l in lead_data if hasattr(l, 'score') and l.score > 0]
        if scores:
            avg_score = sum(scores) / len(scores)
            if avg_score < 6:
                recommendations.append("Focus on lead qualification - average scores are below target")
            elif avg_score > 8:
                recommendations.append("Excellent lead quality - consider scaling acquisition channels")
        
        # Feature-based recommendations
        if 'top_features' in insights.trends:
            top_feature = insights.trends['top_features'][0][0] if insights.trends['top_features'] else None
            if top_feature:
                recommendations.append(f"Highlight '{top_feature}' in marketing - it's your most valued feature")
        
        # Sentiment-based recommendations
        sentiment = insights.sentiment_analysis
        total_sentiment = sentiment.get('positive_indicators', 0) + sentiment.get('negative_indicators', 0)
        if total_sentiment > 0:
            negative_ratio = sentiment.get('negative_indicators', 0) / total_sentiment
            if negative_ratio > 0.3:
                recommendations.append("Address customer concerns - sentiment analysis shows potential issues")
            elif negative_ratio < 0.1:
                recommendations.append("Leverage positive feedback in testimonials and case studies")
        
        # Trend-based recommendations
        if 'score_trend' in insights.trends:
            trend = insights.trends['score_trend']
            if trend['direction'] == 'declining':
                recommendations.append("Investigate declining lead quality - review acquisition sources")
            elif trend['direction'] == 'improving':
                recommendations.append("Capitalize on improving trends - consider increasing marketing spend")
        
        return recommendations[:5]  # Limit to top 5 recommendations

    @staticmethod
    def _identify_risk_factors(lead_data: List[Lead]) -> List[str]:
        """Identify potential risk factors in the lead data"""
        risks = []
        
        # Low score concentration
        low_score_leads = len([l for l in lead_data if hasattr(l, 'score') and l.score < 5])
        if low_score_leads > len(lead_data) * 0.4:  # More than 40% low score
            risks.append("High percentage of low-quality leads may indicate targeting issues")
        
        # Price expectation risks
        prices = []
        for lead in lead_data:
            price = EnhancedAIChatbotService._extract_price_from_lead(lead)
            if price:
                match = re.search(r'\$?(\d+(\.\d+)?)', str(price))
                if match:
                    value = float(match.group(1))
                    if value > 0:
                        prices.append(value)
        
        if prices:
            price_variance = max(prices) / min(prices) if min(prices) > 0 else 0
            if price_variance > 10:  # 10x difference in price expectations
                risks.append("Wide price expectation range may indicate unclear value proposition")
        
        # Feature confusion risk
        feature_counts = defaultdict(int)
        for lead in lead_data:
            if hasattr(lead, 'features') and lead.features:
                feature_counts[len(lead.features)] += 1
        
        if feature_counts and max(feature_counts.values()) < len(lead_data) * 0.3:
            risks.append("Inconsistent feature rating patterns may indicate product confusion")
        
        return risks

    @staticmethod
    def _format_advanced_insights(insights: AdvancedInsights) -> str:
        """Format advanced insights for AI consumption"""
        context = ""
        
        if insights.trends:
            context += "TRENDS:\n"
            for key, value in insights.trends.items():
                context += f"- {key}: {value}\n"
            context += "\n"
        
        if insights.predictions:
            context += "PREDICTIONS:\n"
            for key, value in insights.predictions.items():
                context += f"- {key}: {value}\n"
            context += "\n"
        
        if insights.sentiment_analysis:
            context += f"SENTIMENT: {insights.sentiment_analysis}\n\n"
        
        if insights.recommendations:
            context += f"STRATEGIC RECOMMENDATIONS: {', '.join(insights.recommendations)}\n\n"
        
        if insights.risk_factors:
            context += f"RISK FACTORS: {', '.join(insights.risk_factors)}\n\n"
        
        return context

    @staticmethod
    def _get_lead_date(lead: Lead) -> str:
        """Extract date from lead with multiple fallback fields"""
        for field_name in ['created_at', 'date_created', 'timestamp', 'date']:
            if hasattr(lead, field_name):
                date_value = getattr(lead, field_name)
                if date_value:
                    return str(date_value)
        return ""

    @staticmethod
    def _extract_price_from_lead(lead: Lead) -> str:
        """Extract price information from lead data"""
        if hasattr(lead, 'pricing_willingness') and lead.pricing_willingness:
            return lead.pricing_willingness

        if hasattr(lead, 'dynamic_fields') and lead.dynamic_fields:
            price_field = next(
                (k_v for k_v in lead.dynamic_fields.items()
                 if any(term in k_v[0].lower() for term in ['price', 'pricing', 'cost', 'budget'])),
                None
            )
            return price_field[1] if price_field else ""

        return ""

    @staticmethod
    def analyze_leads_with_enhanced_ai(lead_data: List[Lead], campaign: Campaign, 
                                     user_question: str, user_id: str = "default", 
                                     session_id: str = "default") -> Dict:
        """Enhanced AI analysis with conversation memory and advanced insights"""
        try:
            # Get or create conversation memory
            memory = EnhancedAIChatbotService.get_or_create_memory(user_id, session_id)
            
            # Generate enhanced context
            context = EnhancedAIChatbotService.generate_enhanced_lead_context(lead_data, campaign, memory)
            
            # Determine analysis type from question
            analysis_type = EnhancedAIChatbotService._determine_analysis_type(user_question)
            
            # Build enhanced prompt
            prompt = EnhancedAIChatbotService._build_enhanced_chatbot_prompt(
                context, campaign.name, user_question, memory, analysis_type
            )
            
            # Get AI response
            ai_response = EnhancedAIChatbotService._call_gemini_api(prompt, max_tokens=3072)

            if ai_response:
                # Clean the response
                cleaned_response = EnhancedAIChatbotService._clean_html_response(ai_response)
                
                # Store interaction in memory
                memory.add_interaction(user_question, cleaned_response, analysis_type)
                
                # Extract key insights for future reference
                key_insights = EnhancedAIChatbotService._extract_key_insights(cleaned_response)
                if key_insights:
                    memory.previous_insights.extend(key_insights)
                    memory.previous_insights = memory.previous_insights[-10:]  # Keep last 10
                
                return {
                    "analysis": cleaned_response,
                    "question": user_question,
                    "campaign_id": campaign.id,
                    "lead_count": len(lead_data),
                    "analysis_type": analysis_type,
                    "conversation_id": f"{user_id}_{session_id}",
                    "insights_generated": len(key_insights) if key_insights else 0
                }
            else:
                return {"error": "AI service unavailable"}

        except Exception as e:
            logger.exception("Error in enhanced AI lead analysis")
            return {"error": str(e)}

    @staticmethod
    def _determine_analysis_type(question: str) -> str:
        """Determine the type of analysis based on the user's question"""
        question_lower = question.lower()
        
        if any(word in question_lower for word in ['trend', 'over time', 'change', 'improve', 'decline']):
            return "trend_analysis"
        elif any(word in question_lower for word in ['predict', 'forecast', 'future', 'expect']):
            return "predictive_analysis"
        elif any(word in question_lower for word in ['sentiment', 'feeling', 'opinion', 'feedback']):
            return "sentiment_analysis"
        elif any(word in question_lower for word in ['compare', 'versus', 'difference', 'better']):
            return "comparative_analysis"
        elif any(word in question_lower for word in ['recommend', 'suggest', 'advice', 'should']):
            return "recommendation"
        elif any(word in question_lower for word in ['risk', 'problem', 'issue', 'concern']):
            return "risk_analysis"
        else:
            return "general_analysis"

    @staticmethod
    def _extract_key_insights(response: str) -> List[str]:
        """Extract key insights from AI response for memory storage"""
        insights = []
        
        # Look for bullet points or strong statements
        lines = response.split('\n')
        for line in lines:
            clean_line = re.sub(r'<[^>]+>', '', line).strip()  # Remove HTML tags
            if (len(clean_line) > 20 and 
                any(indicator in clean_line.lower() for indicator in 
                    ['recommend', 'suggest', 'trend', 'increase', 'decrease', 'improve'])):
                insights.append(clean_line[:100])  # Limit length
        
        return insights[:3]  # Keep top 3 insights

    @staticmethod
    def _build_enhanced_chatbot_prompt(lead_context: str, campaign_name: str, 
                                     user_message: str, memory: ConversationMemory, 
                                     analysis_type: str) -> str:
        """Build enhanced prompt with conversation memory and advanced capabilities"""
        
        # Build conversation context
        conversation_context = ""
        if memory.conversation_history:
            recent_interactions = memory.conversation_history[-2:]  # Last 2 interactions
            conversation_context = "RECENT CONVERSATION:\n"
            for interaction in recent_interactions:
                conversation_context += f"Q: {interaction['question'][:100]}\n"
                conversation_context += f"A: {interaction['response'][:150]}...\n\n"

        return f"""You are an advanced AI data analyst and strategic advisor for campaign "{campaign_name}".
Your goal is to provide intelligent, context-aware insights that build on previous conversations and offer actionable recommendations.

USER MESSAGE: "{user_message}"
ANALYSIS TYPE: {analysis_type}

{conversation_context}

ENHANCED LEAD ANALYTICS:
{lead_context}

ADVANCED CAPABILITIES:
- Conversation Memory: Remember and reference previous discussions
- Trend Analysis: Identify patterns and changes over time
- Predictive Insights: Forecast likely outcomes and opportunities
- Strategic Recommendations: Provide specific, actionable advice
- Risk Assessment: Identify potential challenges and mitigation strategies
- Sentiment Analysis: Understand customer feelings and perceptions

INTELLIGENT RESPONSE RULES:

1. **Context Awareness**: Reference previous conversations when relevant, but don't repeat information unless specifically asked.

2. **Greeting Intelligence**: 
   - If greeting: Provide a warm, personalized welcome that acknowledges any previous interactions
   - Example: <h3>Welcome back!</h3><p>Ready to dive deeper into your campaign insights?</p>

3. **Analysis Type Adaptation**:
   - Trend Analysis: Focus on changes over time, patterns, and trajectory
   - Predictive: Emphasize forecasts, likelihood, and future scenarios
   - Sentiment: Highlight emotional indicators and customer satisfaction
   - Comparative: Show differences, benchmarks, and relative performance
   - Recommendations: Provide specific, prioritized action items
   - Risk: Identify threats, challenges, and mitigation strategies

4. **Advanced Insights**:
   - Always integrate multiple data points for richer analysis
   - Provide confidence levels for predictions when possible
   - Suggest follow-up questions to deepen understanding
   - Connect insights to business impact and ROI

5. **Interactive Intelligence**:
   - End responses with 2-3 relevant follow-up questions
   - Suggest related analysis that might be valuable
   - Offer to dive deeper into specific findings

6. **Smart Recommendations**:
   - Prioritize recommendations by impact and feasibility
   - Provide specific next steps, not just general advice
   - Include timeline suggestions when appropriate

RESPONSE FORMAT:
- Use HTML formatting with <h3>, <h4>, <ul>, <li>, <p>, <strong>
- Structure complex insights with clear headings
- Include specific metrics and percentages
- Provide confidence indicators (e.g., "High confidence", "Preliminary data suggests")
- Add interactive elements like suggested follow-ups

CONVERSATION FLOW:
- Build on previous insights without repeating them
- Reference past recommendations and their relevance
- Acknowledge when user is exploring a new area vs. diving deeper
- Maintain context of user's journey through the data

Remember: Be conversational yet professional, insightful yet accessible, and always focus on actionable intelligence that drives business results."""

    @staticmethod
    def _clean_html_response(response: str) -> str:
        """Enhanced HTML response cleaning with formatting preservation"""
        # Remove markdown code blocks
        response = re.sub(r'^```html\s*', '', response, flags=re.IGNORECASE)
        response = re.sub(r'^```\s*', '', response)
        response = re.sub(r'\s*```$', '', response)
        
        # Clean up any remaining backticks
        response = response.strip('`').strip()
        
        # Ensure proper HTML structure
        if not response.startswith('<'):
            response = f'<p>{response}</p>'
        
        return response.strip()

    @staticmethod
    def _call_gemini_api(prompt: str, max_tokens: int = 3072, timeout: int = 60) -> Optional[str]:
        """Enhanced API call with better error handling and retry logic"""
        for config in EnhancedAIChatbotService.API_CONFIGS:
            for attempt in range(3):
                try:
                    logger.info(f"Calling {config['name']} (attempt {attempt + 1})")

                    response = requests.post(
                        config["url"],
                        json={
                            "contents": [{"parts": [{"text": prompt}]}],
                            "generationConfig": {
                                "temperature": 0.1,  # Lower for more consistent analysis
                                "maxOutputTokens": max_tokens,
                                "topP": 0.8,
                                "topK": 10
                            },
                            "safetySettings": [
                                {
                                    "category": "HARM_CATEGORY_HARASSMENT",
                                    "threshold": "BLOCK_NONE"
                                },
                                {
                                    "category": "HARM_CATEGORY_HATE_SPEECH",
                                    "threshold": "BLOCK_NONE"
                                }
                            ]
                        },
                        timeout=timeout
                    )

                    response.raise_for_status()
                    data = response.json()

                    if EnhancedAIChatbotService._validate_gemini_response(data):
                        return data['candidates'][0]['content']['parts'][0]['text'].strip()
                    else:
                        logger.error(f"Invalid response structure: {data}")

                except requests.exceptions.Timeout:
                    logger.warning(f"Timeout on {config['name']} attempt {attempt + 1}")
                    if attempt < 2:
                        import time
                        time.sleep(2 ** attempt)
                        
                except requests.exceptions.RequestException as e:
                    logger.warning(f"Request error on {config['name']}: {e}")
                    if attempt < 2:
                        import time
                        time.sleep(2 ** attempt)

        logger.error("All enhanced AI API attempts failed")
        return None

    @staticmethod
    def _validate_gemini_response(data: Dict[str, Any]) -> bool:
        """Enhanced response validation with better error checking"""
        try:
            candidates = data.get("candidates", [])
            if not candidates or not isinstance(candidates, list):
                return False

            candidate = candidates[0]
            if candidate.get("finishReason") == "SAFETY":
                logger.warning("Response blocked by safety filters")
                return False

            content = candidate.get("content", {})
            parts = content.get("parts", [])

            return (
                isinstance(content, dict) and
                isinstance(parts, list) and
                len(parts) > 0 and
                isinstance(parts[0], dict) and
                "text" in parts[0] and
                len(parts[0]["text"].strip()) > 0
            )
        except Exception as e:
            logger.error(f"Response validation error: {e}")
            return False

    @staticmethod
    def get_conversation_summary(user_id: str, session_id: str) -> Dict[str, Any]:
        """Get a summary of the conversation for analytics"""
        memory = EnhancedAIChatbotService._conversation_memory.get(f"{user_id}_{session_id}")
        if not memory:
            return {"error": "No conversation found"}
        
        return {
            "total_interactions": len(memory.conversation_history),
            "session_duration": (datetime.now() - memory.created_at).total_seconds() / 60,  # minutes
            "analysis_types": list(set([i.get('analysis_type') for i in memory.conversation_history if i.get('analysis_type')])),
            "key_insights": memory.previous_insights,
            "last_interaction": memory.conversation_history[-1] if memory.conversation_history else None
        }

    @staticmethod
    def clear_conversation(user_id: str, session_id: str) -> bool:
        """Clear conversation memory for a user session"""
        key = f"{user_id}_{session_id}"
        if key in EnhancedAIChatbotService._conversation_memory:
            del EnhancedAIChatbotService._conversation_memory[key]
            return True
        return False