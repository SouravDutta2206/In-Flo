import re
from google import genai
from packaging import version
import requests

def extract_version(model_name):
    """Extracts the version object (e.g., '1.5', '2.0') from the model name."""
    # Match patterns like gemini-1.5-..., gemini-2.0-...
    match = re.search(r'gemini-(\d+\.\d+)', model_name)
    if match:
        try:
            return version.parse(match.group(1))
        except version.InvalidVersion:
            return version.parse("0.0") # Assign low version if parsing fails
    return version.parse("0.0") # Default to 0.0 if no version found

def get_sort_priority(model_name):
    """Assigns a numerical priority for sorting within the same version."""
    if '-latest' in model_name:
        return 0 # Highest priority
    elif '-preview' in model_name:
        # Give generic preview higher priority than dated preview
        if re.search(r'-preview-\d{2}-\d{2}$', model_name):
            return 2 # Dated preview
        else:
            return 1 # Generic preview
    else:
        # Base names (like gemini-2.0-flash, gemini-1.5-pro) get lower priority
        return 3

def get_gemini_models_list(api_key):
    gemma_models_list = []
    gemini_models_list = []
    filtered_models_data = []

    client = genai.Client(api_key=api_key)

    for m in client.models.list():

        if 'generateContent' not in m.supported_actions:
            continue

        if 'gemma' in m.name: # and 'gemma' not in m.name:
        
            gemma_models_list.append(m.name.split('/')[1])

        if 'gemini' in m.name:

            gemini_models_list.append(m.name.split('/')[1])


    for model in gemini_models_list:
        
        if model == 'gemini-pro-vision':
            continue
        if model.find('exp') != -1:
            continue
        if model.find('preview') != -1:
            continue
        if re.search(r'-\d{3}$', model.split('-tuning')[0]):
            continue             
        if '-tuning' in model:
            continue

        ver = extract_version(model)
        if ver > version.parse("0.0"):             # Only include if a valid version was found
            filtered_models_data.append({'name': model, 'version': ver})

    all_versions_present = sorted(list(set(m['version'] for m in filtered_models_data)), reverse=True)
    final_selection_data = [m for m in filtered_models_data if m['version'] in all_versions_present]
    final_selection_data.sort(key=lambda item: (
            item['version'],                       # Primary sort key: Version (descending due to reverse=True)
            get_sort_priority(item['name']), # Secondary sort key: Priority (ascending)
            item['name']                           # Tertiary sort key: Name (alphabetical ascending)
        ), reverse=True)
    gemini_sorted_list = [item['name'] for item in final_selection_data]
    models_list = list(set(gemini_sorted_list)) + gemma_models_list

    return models_list

def get_groq_models_list(api_key):

        
        url = "https://api.groq.com/openai/v1/models"
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        models = requests.get(url, headers=headers).json()
        model_list = models.get("data", [])

        return model_list

if __name__ == "__main__":
    api_key = "AIzaSyAMfR2iPgGgF6oGIM-iDlHTCz8t3nGTWUg"
    print(get_gemini_models_list(api_key))


