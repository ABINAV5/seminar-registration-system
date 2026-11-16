# Seminar Registration System

### Linux and Container Technologies Capstone --- 21CSE216P

A small web application for registering students for seminars. The
project uses **HTML, CSS and JavaScript** for the frontend, **Python
Flask** for the backend, **SQLite** for storing registrations, and
**Podman** to build and run the application as a container.

------------------------------------------------------------------------

## 1. What does this project do?

The system lets a student:

-   Register for a seminar by entering student details.
-   View the registered students.
-   Search the registration list.
-   Cancel a registration through a password-protected cancellation
    flow.
-   See the total number of registrations.

The database prevents duplicate student IDs and email addresses using
unique constraints.

## 2. Technologies used

  -----------------------------------------------------------------------
  Technology                          Why it is used
  ----------------------------------- -----------------------------------
  HTML                                Builds the registration page

  CSS                                 Styles the page

  JavaScript                          Handles form submission, search,
                                      listing and cancellation

  Python Flask                        Provides the backend and API routes

  SQLite                              Stores registration records

  Podman                              Builds images and manages
                                      containers

  Podman volume                       Keeps the database outside the
                                      container so data survives
                                      container replacement

  Podman network                      Connects the container to a
                                      user-created network

  Quay.io                             Stores the published container
                                      image

  GitHub                              Stores the project source code
  -----------------------------------------------------------------------

## 3. How the application works

1.  The student opens the application in a browser at
    `http://localhost:5000`.
2.  The frontend sends requests to the Flask backend.
3.  Flask validates the request and reads or writes data in SQLite.
4.  SQLite stores the records in `/data/registrations.db` inside the
    container.
5.  Podman mounts the named volume `seminar-data` at `/data`. The
    database therefore remains in the volume even if the container is
    removed and recreated.

### Simple architecture

``` text
Student's Browser
       |
       | HTTP (localhost:5000)
       v
HTML + CSS + JavaScript
       |
       | API requests
       v
Python Flask Backend
       |
       | SQL queries
       v
SQLite Database: /data/registrations.db
       |
       | stored on
       v
Podman named volume: seminar-data
```

## 4. Project folder structure

``` text
seminar-registrations/
├── app.py
├── requirements.txt
├── Containerfile
├── .gitignore
├── templates/
│   └── index.html
├── static/
│   ├── style.css
│   └── script.js
└── data/
    └── registrations.db   # local database; ignored by Git
```

The database file may be created when the application runs. In the
container, the database path is `/data/registrations.db`.

## 5. Backend API routes

  ---------------------------------------------------------------------------
  Method                  Route                       Purpose
  ----------------------- --------------------------- -----------------------
  `GET`                   `/`                         Opens the web
                                                      application

  `POST`                  `/api/register`             Creates a registration

  `GET`                   `/api/registrations`        Lists registrations;
                                                      accepts a `search`
                                                      query

  `DELETE`                `/api/registrations/<id>`   Cancels a registration
                                                      after password
                                                      verification

  `GET`                   `/api/total`                Returns the total
                                                      registration count
  ---------------------------------------------------------------------------

The registration table stores the student ID, full name, email,
department, year, seminar and registration date. Student ID and email
are unique, case-insensitively.

## 6. Run the application locally (without Podman)

Open PowerShell in the project folder.

### Step 1 --- Create and activate a virtual environment

``` powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### Step 2 --- Install dependencies

``` powershell
pip install -r requirements.txt
```

### Step 3 --- Start the Flask application

``` powershell
python app.py
```

Open:

``` text
http://localhost:5000
```

To stop the local Flask server, press `Ctrl + C` in the terminal.

> If PowerShell blocks virtual-environment activation, use
> `venv\Scripts\python.exe -m pip install -r requirements.txt` and
> `venv\Scripts\python.exe app.py` instead.

## 7. Build the Podman image

Make sure Podman Desktop is running and the Podman machine is started.

``` powershell
podman machine start
```

From the project folder, build the image:

``` powershell
podman build --network=host --format docker -t localhost/seminar-registration:v3 .
```

### What does this command mean?

-   `podman build` --- builds a container image.
-   `--network=host` --- uses host networking for the build.
-   `--format docker` --- builds in Docker image format; this was used
    so the Containerfile healthcheck is retained.
-   `-t` --- gives the image a name and version tag.
-   `localhost/seminar-registration:v3` --- local image name and tag.
-   `.` --- uses the current folder as the build context.

Check that the image exists:

``` powershell
podman images
```

## 8. Create the Podman network and volume

These are named resources. Create them once; if they already exist, do
not create duplicates.

``` powershell
podman network create seminar-network
```

``` powershell
podman volume create seminar-data
```

Check them:

``` powershell
podman network ls
podman volume ls
```

### What are they for?

-   **Network (`seminar-network`):** gives the container a user-defined
    network connection.
-   **Volume (`seminar-data`):** stores the SQLite database at `/data`,
    outside the container's writable layer.

Do not remove `seminar-data` if you want to keep registrations.

## 9. Run the container

The published image is:

``` text
quay.io/abinavkarthikeyam/seminar-registration:v3
```

The following command runs that image and attaches the volume, network,
port mapping, restart policy and resource limits:

``` powershell
podman run -d --name seminar-app -p 5000:5000 -v seminar-data:/data --network seminar-network --restart unless-stopped --memory=512m --cpus=1 quay.io/abinavkarthikeyam/seminar-registration:v3
```

Open the application:

``` text
http://localhost:5000
```

### Explanation of the important options

  -----------------------------------------------------------------------
  Option                              Meaning
  ----------------------------------- -----------------------------------
  `-d`                                Runs the container in the
                                      background

  `--name seminar-app`                Gives the container a convenient
                                      name

  `-p 5000:5000`                      Maps host port 5000 to container
                                      port 5000

  `-v seminar-data:/data`             Mounts the persistent volume at
                                      `/data`

  `--network seminar-network`         Connects the container to the
                                      custom network

  `--restart unless-stopped`          Configures restart handling unless
                                      the container was deliberately
                                      stopped

  `--memory=512m`                     Sets a 512 MB memory limit

  `--cpus=1`                          Sets a one-CPU limit
  -----------------------------------------------------------------------

If a container named `seminar-app` already exists, remove that container
before running the command again:

``` powershell
podman rm -f seminar-app
```

This removes the container, **not** the named volume. Then run the
`podman run` command again.

## 10. Configure the cancellation password

The cancellation route expects a password hash in the environment
variable `CANCEL_PASSWORD_HASH`. Do not put a plain-text password in the
source code or commit a password/hash to GitHub.

Generate a hash locally in PowerShell (with the project's Python
dependencies installed):

``` powershell
$HASH = python -c "from werkzeug.security import generate_password_hash; print(generate_password_hash(input('Enter cancellation password: ')))"
```

Then recreate the container with the hash environment variable. Keep the
same volume and other options:

``` powershell
podman rm -f seminar-app
podman run -d --name seminar-app -p 5000:5000 -v seminar-data:/data --network seminar-network --restart unless-stopped --memory=512m --cpus=1 -e "CANCEL_PASSWORD_HASH=$HASH" quay.io/abinavkarthikeyam/seminar-registration:v3
```

The `$HASH` variable exists only in the current PowerShell session. If
you close the terminal, generate it again before recreating the
container. Do not share the generated hash or password.

## 11. Useful Podman commands (copy and paste)

### See running containers

``` powershell
podman ps
```

### See all containers, including stopped ones

``` powershell
podman ps -a
```

### See local images

``` powershell
podman images
```

### View container logs

``` powershell
podman logs seminar-app
```

### Follow logs continuously

``` powershell
podman logs -f seminar-app
```

Press `Ctrl + C` to stop following logs. This does not stop the
container.

### Inspect the container

``` powershell
podman inspect seminar-app
```

### Check health status only

``` powershell
podman inspect --format '{{.State.Health.Status}}' seminar-app
```

Expected result after startup:

``` text
healthy
```

### Check resource limits

``` powershell
podman inspect --format 'Memory={{.HostConfig.Memory}} NanoCPUs={{.HostConfig.NanoCpus}}' seminar-app
```

Expected values for the configured limits:

``` text
Memory=536870912 NanoCPUs=1000000000
```

### View current resource usage

``` powershell
podman stats --no-stream seminar-app
```

### Stop, start and restart

``` powershell
podman stop seminar-app
podman start seminar-app
podman restart seminar-app
```

### Check restart policy

``` powershell
podman inspect --format '{{.HostConfig.RestartPolicy.Name}}' seminar-app
```

Expected result:

``` text
unless-stopped
```

### Remove a container

``` powershell
podman rm -f seminar-app
```

This does not remove the `seminar-data` volume.

### View network and volume details

``` powershell
podman network inspect seminar-network
podman volume inspect seminar-data
```

## 12. Demonstrate persistent storage

This test shows that registrations remain after a container is removed
and recreated.

1.  Register a test student using the website.
2.  Remove the container:

``` powershell
podman rm -f seminar-app
```

3.  Recreate it using the same `seminar-data` volume:

``` powershell
podman run -d --name seminar-app -p 5000:5000 -v seminar-data:/data --network seminar-network --restart unless-stopped --memory=512m --cpus=1 quay.io/abinavkarthikeyam/seminar-registration:v3
```

4.  Open `http://localhost:5000` and check the registration list.

The records should remain because the database is stored in the named
volume, not in the removed container.

**Important:** Never run `podman volume rm seminar-data` if you need to
preserve the registrations.

## 13. Publish and download the image on Quay.io

### Log in

``` powershell
podman login quay.io
```

Use your Quay.io username and the credential accepted by Quay.io. Never
place your password or token in this README.

### Tag the local image

``` powershell
podman tag localhost/seminar-registration:v3 quay.io/abinavkarthikeyam/seminar-registration:v3
```

### Push to Quay.io

``` powershell
podman push quay.io/abinavkarthikeyam/seminar-registration:v3
```

### Pull from Quay.io

``` powershell
podman pull quay.io/abinavkarthikeyam/seminar-registration:v3
```

### Check the image

``` powershell
podman images
```

The public repository is:

`https://quay.io/repository/abinavkarthikeyam/seminar-registration`

## 14. GitHub commands

The source repository is:

`https://github.com/ABINAV5/seminar-registration-system`

After making changes to project files, use:

``` powershell
git status
git add .
git commit -m "Update seminar registration system"
git push
```

The `.gitignore` excludes the virtual environment, Python cache, `.env`
files, local SQLite database files and `.tar` archives. Do not commit
passwords, tokens, generated secrets or database files containing real
student data.

## 15. Troubleshooting

  -----------------------------------------------------------------------
  Problem                             What to check
  ----------------------------------- -----------------------------------
  Website does not open               Run `podman ps` and
                                      `podman logs seminar-app`; check
                                      port 5000

  Container name already exists       Run `podman rm -f seminar-app`,
                                      then run the container again

  Port 5000 is already in use         Stop the other process/container
                                      using that host port, or choose a
                                      different host port such as
                                      `-p 5001:5000`

  Health status says `starting`       Wait for the application to finish
                                      starting, then inspect again

  Health status says `unhealthy`      Check `podman logs seminar-app` and
                                      verify the app responds on port
                                      5000 inside the container

  Registrations disappeared           Confirm that the container was
                                      started with
                                      `-v seminar-data:/data`; do not
                                      delete the volume

  Quay pull or push fails             Check `podman login quay.io`,
                                      repository name, tag and internet
                                      connection
  -----------------------------------------------------------------------

## 16. Project completion evidence

Capture screenshots for the project report and presentation:

-   Application registration page and successful registration.
-   Search/list page and duplicate-registration validation.
-   Container image build and `podman images`.
-   `podman ps` showing the running container and port mapping.
-   `podman network ls` and `podman volume ls`.
-   `podman inspect` showing health, network, volume and resource
    limits.
-   `podman stats --no-stream seminar-app`.
-   Stop/start/restart lifecycle commands.
-   GitHub repository containing source files.
-   Quay.io repository showing the `v3` tag.
-   Successful `podman push` and `podman pull`.
-   Application running from the Quay.io image with previous
    registrations still present.

------------------------------------------------------------------------

## Project links

-   **GitHub source:**
    https://github.com/ABINAV5/seminar-registration-system
-   **Quay.io image:**
    https://quay.io/repository/abinavkarthikeyam/seminar-registration
-   **Local application:** http://localhost:5000

## 17. Short viva explanation

**What is containerization?**\
Containerization packages an application and its dependencies together
so it can run consistently in different environments.

**Why did you use Podman?**\
Podman builds and manages containers and images. It was used to package
and run this application.

**What is an image?**\
An image is the packaged template used to create a container.

**What is a container?**\
A container is a running instance of an image.

**Why use a volume?**\
A volume keeps important data outside the container. Removing the
container does not remove the volume.

**Why use a network?**\
A user-defined network provides network connectivity between containers.

**What is port mapping?**\
It connects a port on the host machine to a port inside the container.
Here, host port 5000 maps to container port 5000.

**What is a healthcheck?**\
A healthcheck periodically checks whether the application is responding.

**Why set CPU and memory limits?**\
They restrict the resources the container can consume.

**What is Quay.io?**\
Quay.io is a container image registry used to store and distribute
container images.

**What is the difference between GitHub and Quay.io in this project?**\
GitHub stores the source code. Quay.io stores the built container image.

------------------------------------------------------------------------

**Author:** M. Abinav Karthikeya\
**Register Number:** RA2411003010139\
**Course:** 21CSE216P --- Linux and Container Technologies
