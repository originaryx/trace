'use client';

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-3xl font-bold text-gray-900">Settings</h1>

      <div className="space-y-6">
        {/* Domain Settings */}
        <div className="overflow-hidden bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900">Domain</h3>
            <div className="mt-2 max-w-xl text-sm text-gray-500">
              <p>Your current domain: example.com</p>
            </div>
          </div>
        </div>

        {/* API Keys */}
        <div className="overflow-hidden bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900">API Keys</h3>
            <div className="mt-2 max-w-xl text-sm text-gray-500">
              <p>Manage your API keys for event ingestion.</p>
            </div>
            <div className="mt-5">
              <button
                type="button"
                className="inline-flex items-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500"
              >
                Generate New Key
              </button>
            </div>
          </div>
        </div>

        {/* peac.txt Generator */}
        <div className="overflow-hidden bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900">PEAC Policy</h3>
            <div className="mt-2 max-w-xl text-sm text-gray-500">
              <p>Generate your /.well-known/peac.txt file.</p>
            </div>
            <div className="mt-5">
              <button
                type="button"
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              >
                Generate peac.txt
              </button>
            </div>
          </div>
        </div>

        {/* Alerts */}
        <div className="overflow-hidden bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900">Alerts</h3>
            <div className="mt-2 max-w-xl text-sm text-gray-500">
              <p>Configure Slack or email notifications.</p>
            </div>
            <div className="mt-5">
              <input
                type="text"
                placeholder="Slack webhook URL"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
