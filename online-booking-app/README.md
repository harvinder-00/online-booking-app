# Online Room Booking System — DevOps Pipeline Demo

A simple room-booking web app used to demonstrate a full DevOps workflow:

```
Developer → Git Repository → Jenkins → Build & Test → Docker Image → Deployment → Monitoring
```

## What the app does
- Lists 4 meeting rooms
- Lets a user book a room for a date/time (rejects double-bookings)
- Lets a user cancel a booking
- Exposes `GET /health` for automated monitoring / smoke tests

Stack: **plain Node.js** (zero external npm packages), so there's nothing to
install before running — good for a fast Docker build and a fast Jenkins job.

---

## 1. Run it locally (sanity check before anything else)
```bash
node server.js
# open http://localhost:3000
```
Run the tests directly:
```bash
npm test
```

## 2. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit: online booking app"
git branch -M main
git remote add origin https://github.com/<your-username>/online-booking-app.git
git push -u origin main
```

## 3. Run it with Docker (no Jenkins yet — just confirm containerization works)
Requires Docker Desktop running locally.
```bash
docker compose up --build
# open http://localhost:3000
```
Check the health check Docker is running for you:
```bash
docker inspect --format='{{json .State.Health}}' online-booking-app
```

## 4. Set up Jenkins locally
Easiest path: run Jenkins itself as a container, with access to your host's
Docker so it can build/run images.

```bash
docker volume create jenkins_home
docker run -d --name jenkins \
  -p 8080:8080 -p 50000:50000 \
  -v jenkins_home:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  jenkinsci/blueocean
```
Then:
1. Open `http://localhost:8080`, unlock Jenkins using the initial admin
   password (`docker logs jenkins` shows it), install the suggested plugins.
2. Install the **Docker Pipeline** plugin (Manage Jenkins → Plugins) so the
   `docker build` calls in the `Jenkinsfile` work.
3. Make sure `node`, `npm`, and `docker` are available inside the Jenkins
   container/agent (the `jenkinsci/blueocean` image already has Docker CLI
   if you mounted the socket as above; for Node, either use a Docker agent
   in the Jenkinsfile or install NodeJS via the NodeJS plugin).

## 5. Create the Jenkins pipeline job
1. New Item → Pipeline → name it `online-booking-app`.
2. Under **Pipeline**, choose "Pipeline script from SCM" → Git → paste your
   GitHub repo URL → branch `main` → script path `Jenkinsfile`.
3. Save, then click **Build Now**.

The pipeline (see `Jenkinsfile`) will:
- Checkout the repo
- Run `npm test`
- Build the Docker image (`docker build`)
- Deploy it (`docker run`, replacing any previous container)
- Hit `/health` as a smoke test

You can watch each stage go green in the Jenkins UI / Blue Ocean view.

## 6. (Optional) Automate deployment with Ansible instead of raw `docker run`
```bash
cd ansible
ansible-playbook -i inventory.ini deploy.yml
```
This does the same job as the Jenkins "Deploy" stage, but through Ansible —
useful if you want to show configuration-management as a separate part of
the pipeline, or target a real VM (edit `inventory.ini`).

## 7. Monitoring & logs (lightweight version)
- **Health endpoint**: `GET /health` returns uptime and current booking count
  — this is what both the Docker `HEALTHCHECK` and the Jenkins smoke-test
  stage rely on.
- **Container logs**: `docker logs -f online-booking-app`
- **Container resource usage**: `docker stats online-booking-app`
- **Optional upgrade**: if you want a real dashboard for the report, run
  [Portainer](https://www.portainer.io/) (`docker run -d -p 9000:9000
  -v /var/run/docker.sock:/var/run/docker.sock portainer/portainer-ce`) —
  it gives you a GUI over container status/logs with no extra config.

---

## Project structure
```
online-booking-app/
├── server.js              # app + API (pure Node, no deps)
├── public/                 # frontend (HTML/CSS/JS)
├── test/server.test.js     # automated tests (node --test)
├── package.json
├── Dockerfile
├── docker-compose.yml
├── Jenkinsfile              # CI/CD pipeline definition
├── ansible/
│   ├── deploy.yml
│   └── inventory.ini
└── README.md
```

## Mapping to the assignment brief
| Requirement | Where it's satisfied |
|---|---|
| Simple web app | `server.js` + `public/` — room booking system |
| Git/GitHub | Step 2 above |
| Jenkins build & test automation | `Jenkinsfile`, stage "Build & Test" |
| Docker containerization | `Dockerfile`, `docker-compose.yml` |
| Deployment (VM/cloud) | `Jenkinsfile` "Deploy" stage; `ansible/deploy.yml` for VM targets |
| Ansible configuration management | `ansible/deploy.yml` |
| Monitoring / logging | `/health` endpoint, `docker logs`, `docker stats`, optional Portainer |
