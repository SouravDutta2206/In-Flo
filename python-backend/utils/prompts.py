import sys
sys.dont_write_bytecode = True

import re
from google.genai import types

def prompt_with_context(context: str, query: str, source_map: dict[int, dict[str, any]] = None):

    prompt = [
        {
            "role" : "user",
            "content" : re.sub(r"[^\S\n]+", " ", f'''You are an AI assistant tasked with providing detailed answers based solely on the given context. Your goal is to analyze the information provided and formulate a comprehensive, well-structured response to the question.
                        Context: {context}
                        User Question: {query}
                        Source Map: {source_map}
                        Important Instruction to follow strictly-
                        
                        To answer the question:
                        1. You will be provided with a set of context chunks, each wrapped in <source_id='X'> tags.
                        2. Thoroughly analyze the context, identifying key information relevant to the question.
                        3. Organize your thoughts and plan your response to ensure a logical flow of information.
                        4. Formulate a detailed answer that directly addresses the question, using only the information provided in the context.
                        5. Ensure your answer is comprehensive, covering all relevant aspects found in the context.
                        6. If the context doesn't contain sufficient information to fully answer the question, state this clearly in your response.
                        
                        Format your response as follows:
                        1. Use clear, concise language.
                        2. Organize your answer into paragraphs for readability.
                        3. Use bullet points or numbered lists where appropriate to break down complex information.
                        4. If relevant, include any headings or subheadings to structure your response.
                        5. Ensure proper grammar, punctuation, and spelling throughout your answer.

                        Format your response with context as follows and adhere to these guidelines strictly:
                        1. Whenever you make a claim based on a specific chunk, you must cite it immediately at the end of the sentence using the format [id].
                        2. Example: 'The sky is blue [1], and grass is green [2].'
                        3. Do not group citations like [1, 2]; instead use [1][2].
                        4. If the answer is not in the context, state that you do not know.
                        
                        Important: Base your entire response solely on the information provided in the context. Do not include any external knowledge or assumptions not present in the given text.''')
        }
    ]

    return prompt

def base_prompt(query_text: str):

    prompt = [
        {
            "role" : "user",
            "content" : re.sub(r"[^\S\n]+", " ", f'''{query_text}
                        
                        Format your response as follows:
                        1. If the question is about math, use LaTeX syntax, use $...$ for inline math and $$...$$ for display math.
                        2. Follow the $...$ and $$...$$ syntax strictly, do not use any other syntax like \( ... \) or \[ ... \]
                        3. For code, use markdown code blocks with the language specified. Ensure proper indentation and formatting.
                        4. Organize your answer into paragraphs for readability and a clear progression of ideas.
                        5. Use bullet points or numbered lists where appropriate to break down complex information or present a series of related points.
                        6. If relevant, include any headings or subheadings to structure your response.
                        7. Ensure proper grammar, punctuation, and spelling throughout your answer.
                        ''')
        }
    ]

    return prompt

def gemini_prompt_format(prompt: list):

    content = []

    for i, message in enumerate(prompt):

        if message.role == "user":
            content.append(types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=f"""{message.content}"""),
                ],
            ))
            
        if message.role == "assistant":
            content.append(types.Content(
                role="model",
                parts=[
                    types.Part.from_text(text=f"""{message.content}"""),
                ],
            ))

    return content





