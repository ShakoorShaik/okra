export const SERVICES = {
  High: [
    'Post-surgery care',
    'Vital signs monitoring',
    'Night care',
    'Medical appointment escort',
    'Bed transfer',
  ],
  Medium: [
    'Personal hygiene',
    'Assistance with daily living',
    'Dementia care',
    'Check-in visits',
  ],
  Low: [
    'Companionship',
    'Meal preparations and grocery shopping',
    'Light mobility exercises',
    'Medication reminders',
    'Activities for dementia patients',
  ],
};

export const ALL_SERVICES = [...SERVICES.High, ...SERVICES.Medium, ...SERVICES.Low];

export const SERVICE_URGENCY: Record<string, 'High' | 'Medium' | 'Low'> = {
  'Post-surgery care': 'High',
  'Vital signs monitoring': 'High',
  'Night care': 'High',
  'Medical appointment escort': 'High',
  'Bed transfer': 'High',
  'Personal hygiene': 'Medium',
  'Assistance with daily living': 'Medium',
  'Dementia care': 'Medium',
  'Check-in visits': 'Medium',
  'Companionship': 'Low',
  'Meal preparations and grocery shopping': 'Low',
  'Light mobility exercises': 'Low',
  'Medication reminders': 'Low',
  'Activities for dementia patients': 'Low',
};
