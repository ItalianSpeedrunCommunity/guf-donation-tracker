# -*- coding: utf-8 -*-
# Generated by Django 1.11.9 on 2018-01-19 03:25
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0009_donation_request_fields_blank'),
    ]

    operations = [
        migrations.AddField(
            model_name='donor',
            name='alias_num',
            field=models.IntegerField(blank=True, editable=False, null=True, verbose_name='Alias Number'),
        ),
        migrations.AlterUniqueTogether(
            name='donor',
            unique_together={('alias', 'alias_num')},
        ),
    ]
