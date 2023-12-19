CURRENT_VERSION=${1:-"2.6.0"}
NEW_VERSION=${2:-"3.0.0"}

# Prepare branches
git checkout pwa-kit-$CURRENT_VERSION-pre-merge
git checkout pwa-kit-$NEW_VERSION

# Fetch new code from Salesforce's GitHub
git clone https://github.com/SalesforceCommerceCloud/pwa-kit.git --branch v$NEW_VERSION

# Create new project
cd pwa-kit
npm install
node packages/pwa-kit-create-app/scripts/create-mobify-app.js --preset "retail-react-app-demo"

rsync -rv --exclude=node_modules pwa-kit-starter-project/ ..
cd ..
rm -Rf pwa-kit

# Commit and merge
git add -A
git commit -m "pwa-kit upgrade to v$NEW_VERSION"
git tag "pwa-kit-$NEW_VERSION-pre-merge"
git fetch --all
git merge origin/develop

# Now is time to resolve conflicts...
