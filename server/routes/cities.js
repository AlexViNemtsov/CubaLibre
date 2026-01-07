const express = require('express');
const router = express.Router();

// Список городов Кубы
router.get('/', (req, res) => {
  res.json({
    cities: [
      { id: 'la-habana', name: 'Habana', default: true },
      { id: 'santiago-de-cuba', name: 'Santiago de Cuba' },
      { id: 'camaguey', name: 'Camagüey' },
      { id: 'holguin', name: 'Holguín' },
      { id: 'santa-clara', name: 'Santa Clara' },
      { id: 'guantanamo', name: 'Guantánamo' },
      { id: 'bayamo', name: 'Bayamo' },
      { id: 'cienfuegos', name: 'Cienfuegos' },
      { id: 'pinar-del-rio', name: 'Pinar del Río' },
      { id: 'matanzas', name: 'Matanzas' },
      { id: 'las-tunas', name: 'Las Tunas' },
      { id: 'sancti-spiritus', name: 'Sancti Spíritus' },
      { id: 'ciiego-de-avila', name: 'Ciego de Ávila' },
      { id: 'villa-clara', name: 'Villa Clara' },
      { id: 'artemisa', name: 'Artemisa' },
      { id: 'mayabeque', name: 'Mayabeque' },
      { id: 'isla-de-la-juventud', name: 'Isla de la Juventud' },
      { id: 'all', name: 'Toda Cuba' }
    ],
    neighborhoods: {
      'la-habana': [
        'Vedado',
        'Centro Habana',
        'Habana Vieja',
        'Miramar',
        'Playa',
        'Cerro',
        'Diez de Octubre',
        'San Miguel del Padrón',
        'Boyeros',
        'Arroyo Naranjo',
        'Cotorro',
        'Habana del Este',
        'Marianao',
        'La Lisa',
        'Guanabacoa',
        'Regla'
      ]
    }
  });
});

module.exports = router;

