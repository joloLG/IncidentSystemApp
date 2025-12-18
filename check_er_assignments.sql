-- Check what incidents are assigned to ER teams
SELECT
  id,
  status,
  er_team_id,
  responded_at,
  firstName,
  lastName,
  emergency_type,
  created_at
FROM emergency_reports
WHERE er_team_id IS NOT NULL
ORDER BY responded_at DESC, created_at DESC
LIMIT 20;


-- response

-- [
  {
    "id": "1d25fe53-0413-4555-b431-157510641e18",
    "status": "responded",
    "er_team_id": 1,
    "responded_at": "2025-11-02 02:56:00.328+00",
    "firstname": null,
    "lastname": null,
    "emergency_type": "Fire Incident",
    "created_at": "2025-11-02 02:29:09.685+00"
  },
  {
    "id": "cc2c4f33-d6fc-4085-bcae-6b709067c14c",
    "status": "resolved",
    "er_team_id": 1,
    "responded_at": "2025-11-02 01:51:54.035+00",
    "firstname": null,
    "lastname": null,
    "emergency_type": "Fire Incident",
    "created_at": "2025-11-02 01:48:04.019+00"
  },
  {
    "id": "d15ef01c-687a-4256-9104-88c1ec7a5ffc",
    "status": "resolved",
    "er_team_id": 1,
    "responded_at": "2025-11-02 01:48:16.024+00",
    "firstname": null,
    "lastname": null,
    "emergency_type": "Fire Incident",
    "created_at": "2025-11-02 01:48:05.298+00"
  },
  {
    "id": "603836c7-1ce7-40a4-a682-06cda1d01159",
    "status": "responded",
    "er_team_id": 1,
    "responded_at": "2025-11-01 17:11:02.453+00",
    "firstname": null,
    "lastname": null,
    "emergency_type": "Fire Incident",
    "created_at": "2025-11-01 16:27:22.614+00"
  },
  {
    "id": "9d868d2b-00f6-4665-b4c5-416e6ce8d770",
    "status": "responded",
    "er_team_id": 1,
    "responded_at": "2025-11-01 17:10:48.649+00",
    "firstname": null,
    "lastname": null,
    "emergency_type": "Fire Incident",
    "created_at": "2025-11-01 16:29:51.423+00"
  },
  {
    "id": "8706ea6e-a1aa-41cd-b2d4-e96ec047c9e3",
    "status": "responded",
    "er_team_id": 1,
    "responded_at": "2025-11-01 17:09:52.227+00",
    "firstname": null,
    "lastname": null,
    "emergency_type": "Fire Incident",
    "created_at": "2025-11-01 16:30:13.39+00"
  },
  {
    "id": "d88b2f61-c99a-4e33-8ac9-9867533a7f8b",
    "status": "responded",
    "er_team_id": 1,
    "responded_at": "2025-11-01 17:09:40.382+00",
    "firstname": null,
    "lastname": null,
    "emergency_type": "Fire Incident",
    "created_at": "2025-11-01 17:08:42.466+00"
  },
  {
    "id": "3626df9e-022d-447b-8669-539803648cf5",
    "status": "responded",
    "er_team_id": 1,
    "responded_at": "2025-11-01 17:07:54.404+00",
    "firstname": null,
    "lastname": null,
    "emergency_type": "Fire Incident",
    "created_at": "2025-11-01 16:33:14.606+00"
  },
  {
    "id": "84e6319e-1843-4d42-b244-4db2c745a685",
    "status": "responded",
    "er_team_id": 1,
    "responded_at": "2025-11-01 16:56:46.722+00",
    "firstname": null,
    "lastname": null,
    "emergency_type": "Fire Incident",
    "created_at": "2025-11-01 16:42:03.314+00"
  },
  {
    "id": "997defa8-a2a3-481b-a845-187ed914bf20",
    "status": "responded",
    "er_team_id": 1,
    "responded_at": "2025-11-01 16:22:34.393+00",
    "firstname": null,
    "lastname": null,
    "emergency_type": "Fire Incident",
    "created_at": "2025-11-01 16:20:04.231+00"
  },
  {
    "id": "fbfb7ec9-45f3-49df-90ab-3645f0de85c1",
    "status": "responded",
    "er_team_id": 1,
    "responded_at": "2025-11-01 08:48:29.851+00",
    "firstname": null,
    "lastname": null,
    "emergency_type": "Other: Testing Jamorawon",
    "created_at": "2025-10-26 22:53:28.398+00"
  },
  {
    "id": "abbe4ea5-985c-4917-8340-693a3904f46c",
    "status": "responded",
    "er_team_id": 1,
    "responded_at": "2025-11-01 08:23:49.714+00",
    "firstname": null,
    "lastname": null,
    "emergency_type": "Other: Testing Polot",
    "created_at": "2025-10-26 22:57:13.36+00"
  },
  {
    "id": "143c3564-f3c0-421d-a8d6-4dbf332b288f",
    "status": "resolved",
    "er_team_id": 1,
    "responded_at": "2025-11-01 06:46:28.459+00",
    "firstname": null,
    "lastname": null,
    "emergency_type": "Medical Emergency",
    "created_at": "2025-10-26 11:09:59.301+00"
  },
  {
    "id": "a68aa969-9b95-472c-818d-82e81df5cd48",
    "status": "resolved",
    "er_team_id": 1,
    "responded_at": "2025-10-31 16:11:28.235+00",
    "firstname": null,
    "lastname": null,
    "emergency_type": "Fire Incident",
    "created_at": "2025-10-23 06:30:14.367+00"
  },
  {
    "id": "b944f4d9-87cc-43da-919f-1192a82db797",
    "status": "resolved",
    "er_team_id": 1,
    "responded_at": "2025-10-31 15:48:51.069+00",
    "firstname": null,
    "lastname": null,
    "emergency_type": "Vehicular Incident",
    "created_at": "2025-10-23 07:19:39.623+00"
  },
  {
    "id": "474d9c87-6489-42f3-8791-9a7a9e0a8431",
    "status": "resolved",
    "er_team_id": 1,
    "responded_at": "2025-10-31 14:07:54.601+00",
    "firstname": null,
    "lastname": null,
    "emergency_type": "Other: Yadi kami kara algie kuya ",
    "created_at": "2025-10-23 11:27:43.814+00"
  },
  {
    "id": "29a341f4-82b1-4130-a9a0-f7a5d74deaba",
    "status": "resolved",
    "er_team_id": 1,
    "responded_at": "2025-10-31 14:07:04.743+00",
    "firstname": null,
    "lastname": null,
    "emergency_type": "Fire Incident",
    "created_at": "2025-10-31 14:06:37.398+00"
  },
  {
    "id": "575f57d1-9113-4f45-9380-10c1b8388690",
    "status": "responded",
    "er_team_id": 1,
    "responded_at": "2025-10-31 13:52:00.014+00",
    "firstname": null,
    "lastname": null,
    "emergency_type": "Fire Incident",
    "created_at": "2025-10-31 13:51:14.118+00"
  },
  {
    "id": "891f6498-9f4f-4c05-9802-442991bf1296",
    "status": "responded",
    "er_team_id": 1,
    "responded_at": "2025-10-31 13:44:33.051+00",
    "firstname": null,
    "lastname": null,
    "emergency_type": "Fire Incident",
    "created_at": "2025-10-20 02:51:13.091+00"
  },
  {
    "id": "7cf66c37-f2fc-456d-a761-d8796970e1af",
    "status": "responded",
    "er_team_id": 1,
    "responded_at": "2025-10-31 13:37:12.681+00",
    "firstname": null,
    "lastname": null,
    "emergency_type": "Fire Incident",
    "created_at": "2025-10-31 13:33:43.806+00"
  }
]