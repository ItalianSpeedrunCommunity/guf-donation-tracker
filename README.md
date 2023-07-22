# GUF Donation Tracker

Il progetto è un fork di [GDQ Donation Tracker](https://github.com/GamesDoneQuick/donation-tracker), localizzato in Italiano.

### Development

Per impostare il progetto basta copiare il file `.env.example` in `.env` e non sono necessarie modifiche.

Per avviare i container di sviluppo (django + mariadb):

    docker compose -f docker-compose-dev.yml up

Per uscire, `CTRL + C`.

#### Creazione utente admin

Al primo avvio bisogna creare un utente di amministrazione e seguire la procedura:

    docker compose -f docker-compose-dev.yml run guf_donations python manage.py createsuperuser

#### Percorsi

Il percorso base del tracker è sotto http://localhost:8000/tracker/, mentre l'amministrazione è servita da http://localhost:8000/tracker/admin/.

#### Database

Il database non è esposto per scelta, ma si può aggiungere al file `docker-compose-dev.yml` la direttiva per inoltrare le porte sotto al servizio di MariaDB:

    ports:
      - <porta_locale>:3306

#### Sviluppo e ricompilazione

Il processo di compilazione è a volte lungo a causa della copia completa della cartella dei sorgenti e relativa compilazione, sicuramente c'è un metodo migliore riordinando il Dockerfile ma per il momento ce lo facciamo andare bene:

    docker compose -f docker-compose-dev.yml stop
    docker compose -f docker-compose-dev.yml build
    docker compose -f docker-compose-dev.yml up