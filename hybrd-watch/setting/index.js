function makeId() {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

AppSettingsPage({
  state: {
    customExercises: [],
  },
  build(props) {
    this.props = props
    this.state.customExercises = this.loadCustomExercises()

    const exerciseRows = this.state.customExercises.map((exercise, index) =>
      View(
        {
          style: {
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            padding: '8px 0',
            borderBottom: '1px solid #333',
          },
        },
        [
          View({ style: { flex: 1 } }, [Text({}, [exercise.name])]),
          Button({
            label: 'Remove',
            style: { fontSize: '12px', borderRadius: '20px', background: '#333', color: '#ccc', padding: '0 12px' },
            onClick: () => this.removeCustomExercise(index),
          }),
        ]
      )
    )

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
      Section(
        {
          title: 'Custom Exercises',
          description:
            'Not in the built-in library? Add it here and it shows up in a "Custom" group when picking an exercise on the watch. Kept simple on purpose (name only, no muscle group) - a workout using one still syncs to the phone app normally, registering it there too the first time.',
        },
        [
          TextInput({
            label: 'Add exercise',
            placeholder: 'e.g. Cable Pull-Through',
            onChange: (value) => this.addCustomExercise(value),
          }),
          ...exerciseRows,
        ]
      ),
    ])
  },
  loadCustomExercises() {
    try {
      const raw = this.props.settingsStorage.getItem('customExercises')
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  },
  addCustomExercise(name) {
    const trimmed = (name || '').trim()
    if (!trimmed) return
    this.state.customExercises = [...this.state.customExercises, { id: makeId(), name: trimmed }]
    this.saveCustomExercises()
  },
  removeCustomExercise(index) {
    this.state.customExercises = this.state.customExercises.filter((_, i) => i !== index)
    this.saveCustomExercises()
  },
  saveCustomExercises() {
    this.props.settingsStorage.setItem('customExercises', JSON.stringify(this.state.customExercises))
  },
})
