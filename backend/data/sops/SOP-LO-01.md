# SOP-LO-01 Lube-oil system LO-01: overview and normal values
> Synthetic demo SOP for the fictional plant (steam turbine ST-01, Unit 2). Values are SITE SETPOINTS, not standards.

## §1 Purpose
Defines the lube-oil console LO-01 that supplies oil to the journal and thrust bearings of steam turbine ST-01, and the values operators watch.

## §2 Normal operating values
- Header pressure PT-104: 1.6 barg (low alarm and standby start 1.2 barg; low-low trip 0.8 barg).
- Filter differential pressure PDT-101: 0.3 bar clean; change element at 1.0 bar.
- Oil supply temperature after cooler TT-102: 45 degC (high alarm 55 degC).
- Reservoir level LT-101: 70% (high 78%, low 60%).
- Journal bearing pad temperature TE-201/202: about 88 degC (alarm 115 degC, trip 125 degC).
- P-104A motor current IT-104A: about 62 A.

## §3 Alarms and protective actions
- PSL-104 (1.2 barg) starts standby pump P-104B automatically.
- PSLL-104 (0.8 barg) starts DC emergency pump P-105 and trips the turbine.
- Any alarm: inform the shift supervisor and open a case in Optiflow.
