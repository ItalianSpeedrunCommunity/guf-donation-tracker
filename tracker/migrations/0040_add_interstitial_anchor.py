# Generated by Django 5.0 on 2024-03-02 05:38

import django.db.models.deletion
import tracker.validators
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0039_add_incentive_timing'),
    ]

    operations = [
        migrations.AddField(
            model_name='interstitial',
            name='anchor',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, to='tracker.speedrun'),
        ),
        migrations.AlterField(
            model_name='interstitial',
            name='order',
            field=models.IntegerField(null=True, validators=[tracker.validators.positive, tracker.validators.nonzero]),
        ),
    ]
