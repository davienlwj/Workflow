AppSettingsPage({
  build() {
    return View({}, [
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
