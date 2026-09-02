import { DEFAULT_SETTINGS } from '../utils/constants'

AppSettingsPage({
  build(props) {
    return View({}, [
      Section(
        {
          title: 'intervals.icu sync',
          description:
            'Same personal API key as the phone app - see vo2max/README.md "intervals.icu sync" for how to get one. Read-only: nothing on intervals.icu is ever changed from here.',
        },
        [
          TextInput({
            label: 'Athlete ID',
            placeholder: `e.g. i123456`,
            settingsKey: 'intervalsAthleteId',
          }),
          TextInput({
            label: 'API Key',
            placeholder: 'personal API key',
            settingsKey: 'intervalsApiKey',
          }),
        ]
      ),
      Section(
        {
          title: 'Zones & baseline',
          description: 'Match whatever you have set in the phone app so both agree.',
        },
        [
          TextInput({
            label: 'Resting HR (bpm)',
            placeholder: String(DEFAULT_SETTINGS.restingHR),
            settingsKey: 'restingHR',
          }),
          TextInput({
            label: 'Max HR (bpm)',
            placeholder: String(DEFAULT_SETTINGS.maxHR),
            settingsKey: 'maxHR',
          }),
          TextInput({
            label: 'LTHR (bpm)',
            placeholder: String(DEFAULT_SETTINGS.lthr),
            settingsKey: 'lthr',
          }),
          TextInput({
            label: 'Baseline VO2max',
            placeholder: String(DEFAULT_SETTINGS.baselineVO2max),
            settingsKey: 'baselineVO2max',
          }),
          TextInput({
            label: 'Baseline date',
            placeholder: 'YYYY-MM-DD',
            settingsKey: 'baselineDate',
          }),
          Toggle({
            label: 'Use resting-HR (Karvonen) zones instead of LTHR',
            settingsKey: 'useRhrZones',
          }),
        ]
      ),
      Section(
        {
          title: 'Workout sync (GitHub Gist)',
          description:
            'Workouts logged on the watch sync here via a private GitHub Gist you own - see hybrd-watch/README.md "Workout sync" for one-time setup (create a secret gist, generate a personal access token with gist scope). Paste the same Gist ID and token into the phone app\'s Settings so it can pick workouts up.',
        },
        [
          TextInput({
            label: 'Gist ID',
            placeholder: 'from the gist’s URL',
            settingsKey: 'gistId',
          }),
          TextInput({
            label: 'Personal access token',
            placeholder: 'gist-scoped GitHub token',
            settingsKey: 'githubToken',
          }),
        ]
      ),
    ])
  },
})
